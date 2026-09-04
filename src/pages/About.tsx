import React from 'react';
import { Image, Linking, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { Code2, Globe, Mail, ShieldCheck } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useChrome } from '@/context/ChromeContext';
import { PageTransition } from '@/components/PageTransition';
import { ListRow } from '@/components/ui/ListRow';
import { FONTS, RADII } from '@/constants/theme';

const APP_LOGO = require('../../assets/icon.png');
const DEVELOPER_NAME = 'AmerZuher';

// Placeholder links — swap for the real ones before release.
const LINKS = {
  website: 'https://example.com',
  support: 'mailto:support@example.com',
  privacy: 'https://example.com/privacy',
  repo: 'https://github.com/example/birdseye-finance',
};

export default function About() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { headerHeight, navbarHeight } = useChrome();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const year = new Date().getFullYear();

  const linkRows: { icon: React.ReactNode; label: string; url: string }[] = [
    {
      icon: <Globe size={15} color={theme.accent2} />,
      label: t('about.website'),
      url: LINKS.website,
    },
    {
      icon: <Mail size={15} color={theme.accent2} />,
      label: t('about.support'),
      url: LINKS.support,
    },
    {
      icon: <ShieldCheck size={15} color={theme.accent2} />,
      label: t('about.privacy'),
      url: LINKS.privacy,
    },
    {
      icon: <Code2 size={15} color={theme.accent2} />,
      label: t('about.repo'),
      url: LINKS.repo,
    },
  ];

  return (
    <PageTransition>
      <ScrollView
        style={{ backgroundColor: theme.ground }}
        contentContainerStyle={{
          alignItems: 'center',
          padding: 24,
          paddingTop: headerHeight + 32,
          paddingBottom: navbarHeight + 40,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(420)}
          style={{ alignItems: 'center', gap: 14 }}
        >
          <View
            style={{
              width: 108,
              height: 108,
              borderRadius: 30,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LinearGradient
              colors={[`rgba(${theme.glow.a},0.5)`, `rgba(${theme.glow.b},0)`]}
              style={{
                position: 'absolute',
                width: 140,
                height: 140,
                borderRadius: 70,
              }}
            />
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 26,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: `rgba(${theme.glow.a},0.35)`,
              }}
            >
              <Image
                source={APP_LOGO}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </View>
          </View>

          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: theme.textPrimary }}>
              {t('app.name')}
            </Text>
            <Text
              style={{
                fontSize: 12.5,
                color: theme.accent2,
                textAlign: 'center',
                maxWidth: 260,
              }}
            >
              {t('about.tagline')}
            </Text>
            <Text style={{ fontSize: 11, color: theme.textTertiary, marginTop: 4 }}>
              {t('about.version', { version })}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(420).delay(120)}
          style={{
            width: '100%',
            borderRadius: RADII.card,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: theme.textTertiary,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 6,
            }}
          >
            {t('about.linksTitle')}
          </Text>
          {linkRows.map((row, index) => (
            <ListRow
              key={row.label}
              leading={
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: RADII.iconTile,
                    backgroundColor: `rgba(${theme.glow.a},0.14)`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {row.icon}
                </View>
              }
              title={row.label}
              onPress={() => Linking.openURL(row.url)}
              showBottomBorder={index < linkRows.length - 1}
            />
          ))}
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(420).delay(200)}
          style={{ alignItems: 'center', gap: 4 }}
        >
          <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
            {t('about.credit', { name: DEVELOPER_NAME })}
          </Text>
          <Text style={{ fontSize: 10.5, color: theme.textTertiary }}>
            {t('about.copyright', { year, name: t('app.name') })}
          </Text>
        </Animated.View>
      </ScrollView>
    </PageTransition>
  );
}
