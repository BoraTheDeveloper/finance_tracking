import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import type { Theme } from '../theme/theme';
import { AnimatedRingBudget } from './AnimatedRingBudget';
import { AnimatedPressable } from './AnimatedPressable';
import { MOTION_DURATION, MOTION_EASING, shouldAnimate } from './motion';
import { useReducedMotion } from './useReducedMotion';
import { AppText } from './AppText';
import { Glyph, type IconName } from './icons';
import { styles } from './styles';

export function Row({ label, value, theme, strong }: { label: string; value: string; theme: Theme; strong?: boolean }) {
  return <View style={styles.row}><AppText style={[styles.rowLabel, { color: theme.muted }]}>{label}</AppText><AppText style={[styles.rowValue, { color: strong ? theme.primary : theme.text }]}>{value}</AppText></View>;
}

export function SectionHeader({ title, action, theme, onAction }: { title: string; action?: string; theme: Theme; onAction?: () => void }) {
  return <View style={styles.sectionHeader}><AppText style={[styles.sectionTitle, { color: theme.muted }]}>{title}</AppText>{action ? <TouchableOpacity onPress={onAction}><AppText style={[styles.sectionAction, { color: theme.primary }]}>{action}</AppText></TouchableOpacity> : null}</View>;
}

export function EmptyState({ icon, title, body, theme }: { icon: IconName; title: string; body: string; theme: Theme }) {
  return (
    <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primaryWash }]}>
        <MaterialIcons name={icon} size={22} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={[styles.itemTitle, { color: theme.text }]}>{title}</AppText>
        <AppText style={[styles.itemSub, { color: theme.muted, marginTop: 4 }]}>{body}</AppText>
      </View>
    </View>
  );
}

export function Pill({ text, icon, theme }: { text: string; icon: IconName; theme: Theme }) {
  return <View style={[styles.pill, { backgroundColor: theme.surface2 }]}><MaterialIcons name={icon} size={15} color={theme.muted} /><AppText style={[styles.pillText, { color: theme.muted }]}>{text}</AppText></View>;
}

export function AnimatedCue({
  children,
  trigger,
  style,
  distance = 8,
  scale = 0.98,
}: {
  children: ReactNode;
  trigger: string | number | boolean;
  style?: StyleProp<ViewStyle>;
  distance?: number;
  scale?: number;
}) {
  const reducedMotion = useReducedMotion();
  const cue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    cue.stopAnimation();
    if (!shouldAnimate(reducedMotion, MOTION_DURATION.chip)) {
      cue.setValue(1);
      return;
    }
    cue.setValue(0);
    Animated.timing(cue, {
      toValue: 1,
      duration: MOTION_DURATION.chip,
      easing: MOTION_EASING.decelerate,
      useNativeDriver: true,
    }).start();
  }, [cue, reducedMotion, trigger]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: cue,
          transform: reducedMotion
            ? []
            : [
                { translateY: cue.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
                { scale: cue.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) },
              ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function SelectableChip({
  icon,
  label,
  selected,
  selectedColor,
  textColor,
  mutedColor,
  borderColor,
  surfaceColor,
  onPress,
}: {
  icon: string;
  label: string;
  selected: boolean;
  selectedColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  surfaceColor: string;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const selection = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    selection.stopAnimation();
    if (!shouldAnimate(reducedMotion, MOTION_DURATION.chip)) {
      selection.setValue(selected ? 1 : 0);
      return;
    }
    Animated.timing(selection, {
      toValue: selected ? 1 : 0,
      duration: MOTION_DURATION.chip,
      easing: MOTION_EASING.decelerate,
      useNativeDriver: false,
    }).start();
  }, [reducedMotion, selected, selection]);

  const fill = selection.interpolate({ inputRange: [0, 1], outputRange: [surfaceColor, selectedColor] });
  const stroke = selection.interpolate({ inputRange: [0, 1], outputRange: [borderColor, selectedColor] });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`Select ${label} category`}
      accessibilityState={{ selected }}
      onPress={onPress}
      pressedScale={0.97}
      pressedOpacity={0.9}
    >
      <Animated.View style={[styles.chip, { borderColor: stroke, backgroundColor: fill }]}>
        <Glyph name={icon} size={18} color={selected ? textColor : selectedColor} />
        <AppText style={[styles.chipText, { color: selected ? textColor : mutedColor }]}>{label}</AppText>
      </Animated.View>
    </AnimatedPressable>
  );
}

export function SetupDot({
  active,
  activeColor,
  inactiveColor,
}: {
  active: boolean;
  activeColor: string;
  inactiveColor: string;
}) {
  const reducedMotion = useReducedMotion();
  const selected = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    selected.stopAnimation();
    if (!shouldAnimate(reducedMotion, MOTION_DURATION.chip)) {
      selected.setValue(active ? 1 : 0);
      return;
    }
    Animated.timing(selected, {
      toValue: active ? 1 : 0,
      duration: MOTION_DURATION.chip,
      easing: MOTION_EASING.decelerate,
      useNativeDriver: false,
    }).start();
  }, [active, reducedMotion, selected]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: selected.interpolate({ inputRange: [0, 1], outputRange: [8, 22] }),
          backgroundColor: selected.interpolate({ inputRange: [0, 1], outputRange: [inactiveColor, activeColor] }),
        },
      ]}
    />
  );
}

export function Progress({ label, value, total, pct, color, theme }: { label: string; value: string; total: string; pct: number; color: string; theme: Theme }) {
  return <View style={{ marginBottom: 14 }}><View style={styles.row}><AppText style={[styles.rowLabel, { color: theme.muted }]}>{label}</AppText><AppText style={[styles.rowValue, { color: theme.text }]}>{value} <AppText style={{ color: theme.faint }}>/ {total}</AppText></AppText></View><View style={[styles.track, { backgroundColor: theme.surface2 }]}><View style={[styles.fill, { width: `${Math.max(0, Math.min(1, pct)) * 100}%`, backgroundColor: color }]} /></View></View>;
}

export function Upcoming({ icon, color, title, subtitle, amount, theme, onPress, onDone }: { icon: string; color: string; title: string; subtitle: string; amount: string; theme: Theme; onPress?: () => void; onDone: () => void }) {
  return <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={[styles.expenseRow, { borderColor: theme.line }]}><View style={[styles.bubble, { backgroundColor: `${color}22` }]}><Glyph name={icon} color={color} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemName, { color: theme.text }]}>{title}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{subtitle}</AppText></View><AppText style={[styles.amount, { color: theme.text }]}>{amount}</AppText><TouchableOpacity onPress={onDone} style={{ padding: 5, marginLeft: 4 }}><MaterialIcons name="done" size={20} color={theme.green} /></TouchableOpacity></TouchableOpacity>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.statBox}><AppText style={styles.statValue}>{value}</AppText><AppText style={styles.statLabel}>{label}</AppText></View>;
}

export { AnimatedRingBudget };

export function RingBudget({ pct, color, bg }: { pct: number; color: string; bg: string }) {
  return <AnimatedRingBudget pct={pct} color={color} bg={bg} />;
}
