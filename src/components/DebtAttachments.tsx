import React, { useMemo, useState } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  Camera,
  ChevronRight,
  ExternalLink,
  FileImage,
  FileText,
  Images,
  Paperclip,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Badge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassModal } from '@/components/ui/GlassModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { IconButton } from '@/components/ui/IconButton';
import { IconTile } from '@/components/ui/IconTile';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { ListCard } from '@/components/ui/ListCard';
import { ListRow } from '@/components/ui/ListRow';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useDebtAttachments, useDebts } from '@/context/DebtsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { RADII, SEMANTIC } from '@/constants/theme';
import type { DebtAttachment } from '@/db/schema';
import {
  AttachmentTooLargeError,
  attachmentUri,
  discardStagedFile,
  formatBytes,
  isPdf,
  openAttachmentWith,
  pickAttachmentFiles,
  shareAttachment,
  stagePickedFile,
} from '@/lib/attachments';
import type { AttachmentSource, StagedFile } from '@/lib/attachments';
import { localDateStr } from '@/lib/dates';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';

/**
 * Proof attachments UI (FEATURE_SPEC 1.12). Every place that takes proofs shows
 * the same compact Proofs card; the files themselves live in their own sheet
 * (one row per file, typed by icon, with Open with… / Remove) and a preview
 * sheet (zoomable image or PDF card, Open with…, Share, Remove). Two thin
 * wrappers feed it: a form's staged, not-yet-saved files, and a saved debt's
 * (or adjustment's) stored files.
 */

const ROW_ICON_SIZE = 44;
// Row card height estimate (icon + ListRow padding + card gap) — only used to
// size the list sheet; FlashList needs a bounded height and scrolls past it.
const ROW_HEIGHT_ESTIMATE = 78;
const LIST_MAX_HEIGHT_RATIO = 0.55;
const PREVIEW_HEIGHT_RATIO = 0.55;
const MAX_ZOOM = 5;
// Pickers often hand back machine names (a UUID, a hex cache name) rather than
// anything a person chose — those show as "Photo" / "PDF document" instead.
const GENERATED_NAME =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24,})$/i;

export interface AttachmentItem {
  key: string;
  uri: string;
  mimeType: string;
  name: string | null;
  sizeBytes: number;
  /** Local day it was attached; null while still staged in an unsaved form. */
  addedOn: string | null;
  /** Tied to a specific payment/adjustment. */
  linked: boolean;
}

function stagedToItem(file: StagedFile): AttachmentItem {
  return {
    key: file.uri,
    uri: file.uri,
    mimeType: file.mimeType,
    name: file.originalName,
    sizeBytes: file.sizeBytes,
    addedOn: null,
    linked: false,
  };
}

function attachmentToItem(attachment: DebtAttachment, showLinked: boolean): AttachmentItem {
  return {
    key: String(attachment.id),
    uri: attachmentUri(attachment.fileName),
    mimeType: attachment.mimeType,
    name: attachment.originalName,
    sizeBytes: attachment.sizeBytes,
    addedOn: localDateStr(new Date(attachment.createdAt)),
    linked: showLinked && attachment.adjustmentId != null,
  };
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function displayName(item: AttachmentItem, t: Translate): string {
  const base = item.name?.replace(/\.[^.]+$/, '').trim();
  if (item.name && base && !GENERATED_NAME.test(base)) return item.name;
  return isPdf(item.mimeType) ? t('attachments.untitledPdf') : t('attachments.untitledImage');
}

function describe(item: AttachmentItem, t: Translate): string {
  return [
    isPdf(item.mimeType) ? t('attachments.pdf') : t('attachments.image'),
    formatBytes(item.sizeBytes),
    item.addedOn ?? t('attachments.notSaved'),
    item.linked ? t('attachments.linked') : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The file's type as an icon tile — the same tile language as every other list icon in the app. */
function AttachmentTypeIcon({ mimeType, size }: { mimeType: string; size: number }) {
  const { theme } = useTheme();
  const Icon = isPdf(mimeType) ? FileText : FileImage;

  return (
    <IconTile size={size}>
      <Icon size={Math.round(size * 0.44)} color={theme.accent2} />
    </IconTile>
  );
}

interface SourceOption {
  source: AttachmentSource;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

export function AttachmentSourceSheet({
  visible,
  onClose,
  onStaged,
  onError,
}: {
  visible: boolean;
  onClose: () => void;
  onStaged: (files: StagedFile[]) => void;
  onError: (message: string) => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  const options: SourceOption[] = [
    { source: 'camera', icon: Camera, title: t('attachments.camera') },
    {
      source: 'library',
      icon: Images,
      title: t('attachments.library'),
      subtitle: t('attachments.libraryHint'),
    },
    {
      source: 'files',
      icon: FileText,
      title: t('attachments.files'),
      subtitle: t('attachments.filesHint'),
    },
  ];

  const choose = async (source: AttachmentSource) => {
    onClose();
    try {
      const picked = await pickAttachmentFiles(source);
      if (!picked || picked.length === 0) return;
      const staged: StagedFile[] = [];
      let tooLarge = false;
      for (const file of picked) {
        try {
          staged.push(await stagePickedFile(file));
        } catch (error) {
          if (error instanceof AttachmentTooLargeError) tooLarge = true;
          else throw error;
        }
      }
      if (staged.length > 0) onStaged(staged);
      if (tooLarge) onError(t('attachments.tooLarge'));
    } catch {
      onError(t('attachments.error'));
    }
  };

  return (
    <GlassModal visible={visible} onClose={onClose} title={t('attachments.sourceTitle')}>
      {options.map(({ source, icon: Icon, title, subtitle }, index) => (
        <ListCard key={source} isLast={index === options.length - 1}>
          <ListRow
            showBottomBorder={false}
            onPress={() => void choose(source)}
            leading={
              <IconTile size={38}>
                <Icon size={17} color={theme.accent2} />
              </IconTile>
            }
            title={title}
            subtitle={subtitle}
          />
        </ListCard>
      ))}
    </GlassModal>
  );
}

function ZoomableImage({ uri, height }: { uri: string; height: number }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      offsetX.value = savedX.value + e.translationX;
      offsetY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = offsetX.value;
      savedY.value = offsetY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(1);
      savedScale.value = 1;
      offsetX.value = withTiming(0);
      offsetY.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
    });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan))}>
      <View style={{ height, overflow: 'hidden', borderRadius: RADII.field }}>
        <Animated.Image
          source={{ uri }}
          resizeMode="contain"
          style={[{ width: '100%', height: '100%' }, imageStyle]}
        />
      </View>
    </GestureDetector>
  );
}

interface AttachmentsFieldProps {
  items: AttachmentItem[];
  onAdd: (files: StagedFile[]) => void;
  onRemove: (item: AttachmentItem) => void;
  onError: (message: string) => void;
  /** Ask before removing — for files that are already saved. */
  confirmRemove?: boolean;
}

/** The Proofs card + its list, preview, source and remove-confirm sheets. */
function AttachmentsField({
  items,
  onAdd,
  onRemove,
  onError,
  confirmRemove,
}: AttachmentsFieldProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { height: windowHeight } = useWindowDimensions();

  const [listOpen, setListOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  // Data and visibility kept separate so the preview doesn't blank out mid-close.
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AttachmentItem | null>(null);
  const [openError, setOpenError] = useState('');

  const hasItems = items.length > 0;
  const imageCount = items.filter((item) => !isPdf(item.mimeType)).length;
  const pdfCount = items.length - imageCount;
  const summary = [
    imageCount > 0 ? t('attachments.imageCount', { count: imageCount }) : null,
    pdfCount > 0 ? t('attachments.pdfCount', { count: pdfCount }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Nothing attached yet: straight to the source picker. Otherwise: the list.
  const openCard = () => (hasItems ? setListOpen(true) : setSourceOpen(true));

  const openPreview = (item: AttachmentItem) => {
    setOpenError('');
    setPreviewItem(item);
    setPreviewOpen(true);
  };

  const removeNow = (item: AttachmentItem) => {
    onRemove(item);
    if (previewItem?.key === item.key) setPreviewOpen(false);
  };

  const requestRemove = (item: AttachmentItem) => {
    if (confirmRemove) setRemoveTarget(item);
    else removeNow(item);
  };

  const runExternal = async (action: typeof openAttachmentWith, item: AttachmentItem) => {
    setOpenError('');
    try {
      await action(item.uri, item.mimeType);
    } catch {
      setOpenError(t('attachments.openError'));
    }
  };

  const listHeight = Math.min(
    Math.round(windowHeight * LIST_MAX_HEIGHT_RATIO),
    Math.max(items.length, 1) * ROW_HEIGHT_ESTIMATE,
  );

  return (
    <>
      <ListCard isLast>
        <ListRow
          onPress={openCard}
          showBottomBorder={false}
          leading={
            <IconTile size={38}>
              <Paperclip size={17} color={theme.accent2} />
            </IconTile>
          }
          title={t('attachments.title')}
          subtitle={hasItems ? summary : t('attachments.emptyHint')}
          trailing={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {hasItems ? <Badge label={String(items.length)} variant="accent" /> : null}
              <IconButton
                icon={hasItems ? ChevronRight : Plus}
                accessibilityLabel={hasItems ? t('attachments.viewAll') : t('attachments.add')}
                onPress={openCard}
                directional={hasItems}
                size={24}
                iconSize={12}
              />
            </View>
          }
        />
      </ListCard>

      <GlassModal
        visible={listOpen}
        onClose={() => setListOpen(false)}
        title={t('attachments.sheetTitle', { count: items.length })}
        scrollable={false}
      >
        {openError ? (
          <InlineBanner kind="error" message={openError} onDismiss={() => setOpenError('')} />
        ) : null}
        <SecondaryButton
          icon={Plus}
          label={t('attachments.add')}
          onPress={() => setSourceOpen(true)}
        />
        <View style={{ height: listHeight }}>
          <FlashList
            data={items}
            keyExtractor={(item) => item.key}
            {...HIDDEN_SCROLLBARS}
            ListEmptyComponent={<EmptyState icon={Paperclip} caption={t('attachments.empty')} />}
            renderItem={({ item, index }) => (
              <ListCard isLast={index === items.length - 1}>
                <ListRow
                  showBottomBorder={false}
                  onPress={() => openPreview(item)}
                  leading={<AttachmentTypeIcon mimeType={item.mimeType} size={ROW_ICON_SIZE} />}
                  title={displayName(item, t)}
                  subtitle={describe(item, t)}
                  trailing={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <IconButton
                        icon={ExternalLink}
                        accessibilityLabel={t('attachments.openWith')}
                        onPress={() => void runExternal(openAttachmentWith, item)}
                        size={30}
                        iconSize={13}
                      />
                      <IconButton
                        icon={Trash2}
                        color={SEMANTIC.negative}
                        accessibilityLabel={t('attachments.remove')}
                        onPress={() => requestRemove(item)}
                        size={30}
                        iconSize={13}
                      />
                    </View>
                  }
                />
              </ListCard>
            )}
          />
        </View>
      </GlassModal>

      <GlassModal
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewItem ? displayName(previewItem, t) : undefined}
      >
        {previewItem ? (
          <>
            {openError ? (
              <InlineBanner kind="error" message={openError} onDismiss={() => setOpenError('')} />
            ) : null}
            <Text style={{ textAlign: 'center', fontSize: 11.5, color: theme.textTertiary }}>
              {describe(previewItem, t)}
            </Text>

            {isPdf(previewItem.mimeType) ? (
              <View
                style={{
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 28,
                  borderRadius: RADII.card,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceAlt,
                }}
              >
                <AttachmentTypeIcon mimeType={previewItem.mimeType} size={72} />
                <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: 'center' }}>
                  {t('attachments.pdfPreviewHint')}
                </Text>
              </View>
            ) : (
              <ZoomableImage
                key={previewItem.key}
                uri={previewItem.uri}
                height={Math.round(windowHeight * PREVIEW_HEIGHT_RATIO)}
              />
            )}

            <GradientButton
              icon={ExternalLink}
              label={t('attachments.openWith')}
              onPress={() => void runExternal(openAttachmentWith, previewItem)}
            />
            {/* On iOS "Open with…" already is the share sheet — a second button would duplicate it. */}
            {Platform.OS === 'android' ? (
              <SecondaryButton
                icon={Share2}
                label={t('attachments.share')}
                onPress={() => void runExternal(shareAttachment, previewItem)}
              />
            ) : null}
            <SecondaryButton
              variant="link"
              icon={Trash2}
              color={SEMANTIC.negative}
              label={t('attachments.remove')}
              onPress={() => requestRemove(previewItem)}
            />
          </>
        ) : null}
      </GlassModal>

      <AttachmentSourceSheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onStaged={onAdd}
        onError={onError}
      />

      <ConfirmModal
        visible={!!removeTarget}
        title={t('attachments.deleteTitle')}
        subtitle={removeTarget ? displayName(removeTarget, t) : undefined}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) removeNow(removeTarget);
          setRemoveTarget(null);
        }}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </>
  );
}

/** A form's not-yet-saved proofs: staged now, committed when the form saves. */
export function StagedAttachmentsField({
  staged,
  setStaged,
  onError,
}: {
  staged: StagedFile[];
  setStaged: React.Dispatch<React.SetStateAction<StagedFile[]>>;
  onError: (message: string) => void;
}) {
  const items = useMemo(() => staged.map(stagedToItem), [staged]);

  return (
    <AttachmentsField
      items={items}
      onAdd={(files) => setStaged((current) => [...current, ...files])}
      onRemove={(item) => {
        const file = staged.find((f) => f.uri === item.key);
        if (file) discardStagedFile(file);
        setStaged((current) => current.filter((f) => f.uri !== item.key));
      }}
      onError={onError}
    />
  );
}

/**
 * A saved debt's proofs, added and removed immediately. With `adjustmentId`,
 * only that entry's proofs are listed and new ones are linked to it.
 */
export function SavedAttachmentsField({
  debtId,
  adjustmentId,
  onError,
}: {
  debtId: number;
  adjustmentId?: number;
  onError: (message: string) => void;
}) {
  const { t } = useLanguage();
  const attachments = useDebtAttachments(debtId);
  const { addAttachments, deleteAttachment } = useDebts();

  const rows = useMemo(
    () =>
      adjustmentId == null
        ? attachments
        : attachments.filter((attachment) => attachment.adjustmentId === adjustmentId),
    [attachments, adjustmentId],
  );
  const items = useMemo(
    () => rows.map((row) => attachmentToItem(row, adjustmentId == null)),
    [rows, adjustmentId],
  );

  return (
    <AttachmentsField
      items={items}
      confirmRemove
      onAdd={(files) => {
        addAttachments(debtId, files, adjustmentId ?? null).catch(() => {
          files.forEach(discardStagedFile);
          onError(t('attachments.error'));
        });
      }}
      onRemove={(item) => {
        const row = rows.find((r) => String(r.id) === item.key);
        if (row) deleteAttachment(row);
      }}
      onError={onError}
    />
  );
}
