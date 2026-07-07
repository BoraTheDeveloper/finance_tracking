import { useEffect, useRef } from 'react';
import { Animated, Image, ScrollView, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '../theme/theme';
import { AnimatedPressable } from './AnimatedPressable';
import { AppText } from './AppText';
import { MOTION_EASING } from './motion';
import { styles } from './styles';
import { useReducedMotion } from './useReducedMotion';

export type WelcomeScreenProps = Readonly<{
  theme: Theme;
  onStart: () => void;
}>;

const WELCOME_CHIPS = [
  { icon: 'lock' as const, label: 'No sign-in' },
  { icon: 'wifi-off' as const, label: 'Works offline' },
  { icon: 'backup' as const, label: 'Backup ready' },
] as const;

function animatedIntroStyle(value: Animated.Value, distance: number) {
  return {
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  };
}

export function WelcomeScreen({ theme, onStart }: WelcomeScreenProps) {
  const reducedMotion = useReducedMotion();
  const brand = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const hero = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const chips = useRef(WELCOME_CHIPS.map(() => new Animated.Value(reducedMotion ? 1 : 0))).current;
  const preview = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const footer = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const safeInsets = useSafeAreaInsets();
  const footerBottomPadding = Math.max(16, safeInsets.bottom + 10);

  useEffect(() => {
    if (reducedMotion) {
      brand.setValue(1);
      hero.setValue(1);
      chips.forEach((value) => value.setValue(1));
      preview.setValue(1);
      footer.setValue(1);
      return;
    }

    const timing = (value: Animated.Value, toValue: number, duration: number) => Animated.timing(value, {
      toValue,
      duration,
      easing: MOTION_EASING.decelerate,
      useNativeDriver: true,
    });

    Animated.sequence([
      Animated.parallel([timing(brand, 1, 180), timing(hero, 1, 240)]),
      Animated.stagger(70, chips.map((value) => timing(value, 1, 180))),
      Animated.parallel([timing(preview, 1, 200), timing(footer, 1, 200)]),
    ]).start();
  }, [brand, chips, footer, hero, preview, reducedMotion]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.page }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(132, footerBottomPadding + 104) }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.brandRow, animatedIntroStyle(brand, 4), { marginTop: 8, marginBottom: 28 }]}>
          <Image source={require('../../assets/luy-khnom-favicon-flat.png')} style={styles.logo} resizeMode="contain" />
          <AppText style={[styles.brandName, { color: theme.text }]}>Luy Khnom</AppText>
        </Animated.View>

        <Animated.View style={animatedIntroStyle(hero, 8)}>
          <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.88} style={[styles.heroTitle, { color: theme.text, marginTop: 0 }]}>Spend calm today</AppText>
          <AppText style={[styles.subtitle, { color: theme.muted, fontSize: 16, lineHeight: 22 }]}>Know what is safe to spend.</AppText>
          <AppText style={[styles.help, { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 10 }]}>Track cash, ABA, or KHQR in seconds.</AppText>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line, flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, marginTop: 20 }]}>
            <View style={[styles.bubble, { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.primaryWash }]}>
              <MaterialIcons name="phonelink-lock" size={21} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={[styles.itemTitle, { color: theme.text }]}>Private and local</AppText>
              <AppText style={[styles.itemSub, { color: theme.muted, marginTop: 4 }]}>No account. Data stays here.</AppText>
            </View>
          </View>
        </Animated.View>

        <View style={{ marginTop: 16 }} accessibilityLabel="Welcome promises" accessible>
          <AppText style={[styles.label, { color: theme.muted, marginTop: 0 }]}>Designed for</AppText>
          <View style={styles.chipRow}>
            {WELCOME_CHIPS.map((chip, index) => (
              <Animated.View key={chip.label} style={[animatedIntroStyle(chips[index], 8), styles.chip, { backgroundColor: theme.surface, borderColor: theme.line }]} pointerEvents="none">
                <MaterialIcons name={chip.icon} size={17} color={theme.faint} />
                <AppText style={[styles.chipText, { color: theme.muted }]}>{chip.label}</AppText>
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.View style={[styles.card, animatedIntroStyle(preview, 4), { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={[styles.row, { alignItems: 'center', gap: 12, marginBottom: 12 }]}>
            <View style={{ flex: 1 }}>
              <AppText style={[styles.itemTitle, { color: theme.text, fontSize: 16 }]}>Today starts empty</AppText>
              <AppText style={[styles.itemSub, { color: theme.muted, marginTop: 4 }]}>Real spending fills this in.</AppText>
            </View>
            <View style={[styles.bubbleLarge, { backgroundColor: theme.primaryWash }]}>
              <MaterialIcons name="donut-large" size={27} color={theme.primary} />
            </View>
          </View>
          <View style={{ height: 10, borderRadius: 99, backgroundColor: theme.surface2, opacity: 0.55 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        </Animated.View>

      </ScrollView>

      <Animated.View style={[styles.footer, animatedIntroStyle(footer, 10), { backgroundColor: theme.page, borderColor: theme.line, paddingBottom: footerBottomPadding }]}>
        <AppText style={[styles.itemSub, { color: theme.muted, textAlign: 'center', marginBottom: 8 }]}>Takes about 1 minute</AppText>
        <AnimatedPressable accessibilityRole="button" accessibilityLabel="Set up my budget" style={[styles.button, { backgroundColor: theme.primary }]} contentStyle={styles.buttonContent} onPress={onStart}>
          <AppText numberOfLines={1} style={styles.buttonText}>Set up my budget</AppText>
          <MaterialIcons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}
