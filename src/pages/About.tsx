import React from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CircleQuestionMark,
  CreditCard,
  ExternalLink,
  Gift,
  Globe,
  Heart,
  Mail,
  Sparkles,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useChrome } from '@/context/ChromeContext';
import { PageTransition } from '@/components/PageTransition';
import { Avatar } from '@/components/ui/Avatar';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { SettingsCard } from '@/components/ui/SettingsCard';
import { BrandGlyph } from '@/components/BrandGlyph';
import { FONTS, RADII } from '@/constants/theme';


// TODO real values — see chat: repo URL is a placeholder (unknown actual
// from the GitHub handle (not confirmed real), and the email domain looks
// like a typo for "outlook.com" — confirm before shipping.
const DEVELOPER_EMAIL = 'amerzuher@oultook.com';
const DEVELOPER_WEBSITE = 'https://github.com/AmerZuher';
// GitHub always redirects this to whatever avatar is currently set on the
// profile — no re-uploading to assets/ every time it changes.
const DEVELOPER_AVATAR = 'https://github.com/AmerZuher.png';
const LINKS = {
  repo: 'https://github.com/AmerZuher/BirdEyeFinance',
  githubSponsor: 'https://github.com/sponsors/AmerZuher',
  paypal: 'https://paypal.me/amerzuher',
};

// SettingsCard's own `title` is plain text with no icon slot, so this
// renders as SettingsCard's first child instead, on cards that need an
// icon next to the title — SettingsCard itself isn't touched.
function CardTitle({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Icon size={16} color={theme.accent2} />
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: theme.textPrimary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

interface SupportButtonProps {
  icon: LucideIcon;
  brandGlyphSlug?: string;
  label: string;
  tint: { bg: string; border: string; fg: string };
  onPress: () => void;
}

/** Page-local pill button, not a shared primitive — GradientButton/
 * SecondaryButton are fixed to the theme accent gradient / a neutral ghost
 * fill, neither of which fits a per-service brand tint (amber/pink/blue),
 * so this composes the same bordered-pill shape locally instead of forcing
 * those two to grow a one-off variant only About.tsx would ever use. */
function SupportButton({ icon: Icon, label, tint, onPress }: SupportButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: RADII.pill,
        backgroundColor: tint.bg,
        borderWidth: 1,
        borderColor: tint.border,
      }}
    >
      <Icon size={15} color={tint.fg} />
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: tint.fg }}>{label}</Text>
    </Pressable>
  );
}

export default function About() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { headerHeight, navbarHeight } = useChrome();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const year = new Date().getFullYear();
  const appLogo = require('../../assets/icon.png');

  const supportTints = {
    sponsor: { bg: 'rgba(236,72,153,0.14)', border: 'rgba(236,72,153,0.3)', fg: '#ec4899' },
    paypal: { bg: 'rgba(96,165,250,0.14)', border: 'rgba(96,165,250,0.3)', fg: '#60a5fa' },
  };
  // Not brand-tinted like the support buttons above — email/website aren't
  // tied to a third-party service's own color, so this uses the theme's own
  // accent instead, same convention as the version pill.
  const contactTint = {
    bg: `rgba(${theme.glow.a},0.14)`,
    border: `rgba(${theme.glow.a},0.3)`,
    fg: theme.accent2,
  };

  return (
    <PageTransition>
      <ScrollView
        style={{ backgroundColor: theme.ground }}
        contentContainerStyle={{
          padding: 16,
          paddingTop: headerHeight + 16,
          gap: 14,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View
          entering={FadeInDown.duration(420)}
          style={{ alignItems: 'center', gap: 16 }}
        >
          <View style={{ width: 124, height: 124, alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient
              colors={[`rgba(${theme.glow.a},0.55)`, `rgba(${theme.glow.b},0.25)`]}
              style={{
                position: 'absolute',
                width: 120,
                height: 120,
                borderRadius: 25,
              }}
            />
            <View style={{ width: 100, height: 100 }}>
              <Image source={appLogo} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
          </View>

          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: theme.textPrimary }}>
              {t('app.name')}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: theme.accent2,
                textAlign: 'center',
                maxWidth: 280,
              }}
            >
              {t('about.tagline')}
            </Text>
          </View>

          {/* Version pill */}
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: RADII.pill,
              backgroundColor: `rgba(${theme.glow.a},0.14)`,
              borderWidth: 1,
              borderColor: `rgba(${theme.glow.a},0.22)`,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Sparkles size={12} color={theme.accent2} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.accent2 }}>
              {t('about.version', { version })}
            </Text>
          </View>
        </Animated.View>

        {/* Developer profile */}
        <Animated.View entering={FadeInUp.duration(420).delay(100)}>
          <SettingsCard>
            <CardTitle icon={CircleQuestionMark} label={t('about.developerProfileTitle')} />
            <View style={{ gap: 14 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  borderRadius: RADII.txList,
                  backgroundColor: theme.ground,
                  padding: 14,
                }}
              >
                <Avatar
                  name={t('about.developerName')}
                  photoUri={DEVELOPER_AVATAR}
                  size={56}
                  ring="accent"
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>
                    {t('about.developerName')}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.accent2 }}>
                    {t('about.developerRole')}
                  </Text>
                  <Text style={{ fontSize: 11, lineHeight: 16, color: theme.textTertiary }}>
                    {t('about.developerBio')}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SupportButton
                  icon={Globe}
                  label={t('about.websiteButton')}
                  tint={contactTint}
                  onPress={() => Linking.openURL(DEVELOPER_WEBSITE)}
                />
                <SupportButton
                  icon={Mail}
                  label={t('about.emailButton')}
                  tint={contactTint}
                  onPress={() => Linking.openURL(`mailto:${DEVELOPER_EMAIL}`)}
                />
              </View>
            </View>
          </SettingsCard>
        </Animated.View>

        {/* About / repo / privacy */}
        <Animated.View entering={FadeInUp.duration(420).delay(220)}>
          <SettingsCard>
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 13, lineHeight: 20, color: theme.textSecondary }}>
                {t('about.description')}
              </Text>

              <Pressable
                onPress={() => Linking.openURL(LINKS.repo)}
                accessibilityRole="button"
                accessibilityLabel={t('about.repoButton')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  paddingVertical: 14,
                  borderRadius: RADII.pill,
                  backgroundColor: theme.isLight ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.35)',
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <BrandGlyph slug="github" size={17} color={theme.textPrimary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>
                  {t('about.repoButton')}
                </Text>
                <ExternalLink size={14} color={theme.textTertiary} />
              </Pressable>

              <InlineBanner kind="success" message={t('about.dataSafe')} />
            </View>
          </SettingsCard>
        </Animated.View>

        {/* Support development */}
        <Animated.View entering={FadeInUp.duration(420).delay(160)}>
          <SettingsCard>
            <CardTitle icon={Heart} label={t('about.supportTitle')} />
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 12.5, lineHeight: 19, color: theme.textSecondary }}>
                {t('about.supportDescription')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SupportButton
                  icon={Gift}
                  label={t('about.githubSponsor')}
                  tint={supportTints.sponsor}
                  onPress={() => Linking.openURL(LINKS.githubSponsor)}
                />
              </View>
              <SupportButton
                icon={CreditCard}
                label={t('about.paypalSupport')}
                tint={supportTints.paypal}
                onPress={() => Linking.openURL(LINKS.paypal)}
              />
            </View>
          </SettingsCard>
        </Animated.View>

        {/* Footer */}
        <Animated.View
          entering={FadeInUp.duration(420).delay(280)}
          style={{ alignItems: 'center', gap: 8, paddingTop: 4 }}
        >
          <Text style={{ fontSize: 10.5, color: theme.textTertiary }}>
            {t('about.copyright', { year, name: t('app.name') })}
          </Text>
        </Animated.View>

      </ScrollView>
    </PageTransition>
  );
}
