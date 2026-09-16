import React from 'react';
import { Image, Linking, ScrollView, Text, View } from 'react-native';
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
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { FONTS, RADII, SUPPORT_TINTS } from '@/constants/theme';
import { RATES_ATTRIBUTION_URL } from '@/lib/exchangeRates';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';

// Developer contact details — confirmed by the developer (2026-09-15).
const DEVELOPER_EMAIL = 'amerzuher@outlook.com';
const DEVELOPER_WEBSITE = 'https://amer-alreyahi.vercel.app/';
// GitHub always redirects this to whatever avatar is currently set on the
// profile — no re-uploading to assets/ every time it changes.
const DEVELOPER_AVATAR = 'https://github.com/AmerZuher.png';
const LINKS = {
  repo: 'https://github.com/AmerZuher/Birds_Eye_Finance',
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

export default function About() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { headerHeight } = useChrome();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const year = new Date().getFullYear();
  const appLogo = require('../../assets/icon.png');

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
        {...HIDDEN_SCROLLBARS}
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
                borderRadius: RADII.logoTile,
              }}
            />
            <View style={{ width: 80, height: 80 }}>
              <Image
                source={appLogo}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
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
                <View style={{ flex: 1 }}>
                  <SecondaryButton
                    variant="pill"
                    icon={Globe}
                    label={t('about.websiteButton')}
                    onPress={() => Linking.openURL(DEVELOPER_WEBSITE)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SecondaryButton
                    variant="pill"
                    icon={Mail}
                    label={t('about.emailButton')}
                    onPress={() => Linking.openURL(`mailto:${DEVELOPER_EMAIL}`)}
                  />
                </View>
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

              <SecondaryButton
                variant="pill"
                tone="neutral"
                leading={<BrandGlyph slug="github" size={17} color={theme.textPrimary} />}
                trailingIcon={ExternalLink}
                label={t('about.repoButton')}
                onPress={() => Linking.openURL(LINKS.repo)}
              />

              <InlineBanner kind="success" message={t('about.dataSafe')} />

              {/* ExchangeRate-API's open-access terms require this link to be shown somewhere in
                  the app; it lives here rather than on the rates setting itself. Set apart as a
                  centered footnote under a hairline so it reads as fine print, not a stray line. */}
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: theme.border,
                  paddingTop: 12,
                  marginTop: 2,
                }}
              >
                <SecondaryButton
                  variant="caption"
                  align="center"
                  trailingIcon={ExternalLink}
                  label={t('settings.rates.attribution')}
                  onPress={() => Linking.openURL(RATES_ATTRIBUTION_URL)}
                />
              </View>
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
              <SecondaryButton
                variant="pill"
                icon={Gift}
                color={SUPPORT_TINTS.sponsor}
                label={t('about.githubSponsor')}
                onPress={() => Linking.openURL(LINKS.githubSponsor)}
              />
              <SecondaryButton
                variant="pill"
                icon={CreditCard}
                color={SUPPORT_TINTS.paypal}
                label={t('about.paypalSupport')}
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
