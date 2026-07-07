import { TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

import type { Theme } from '../theme/theme';
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

export function Progress({ label, value, total, pct, color, theme }: { label: string; value: string; total: string; pct: number; color: string; theme: Theme }) {
  return <View style={{ marginBottom: 14 }}><View style={styles.row}><AppText style={[styles.rowLabel, { color: theme.muted }]}>{label}</AppText><AppText style={[styles.rowValue, { color: theme.text }]}>{value} <AppText style={{ color: theme.faint }}>/ {total}</AppText></AppText></View><View style={[styles.track, { backgroundColor: theme.surface2 }]}><View style={[styles.fill, { width: `${Math.max(0, Math.min(1, pct)) * 100}%`, backgroundColor: color }]} /></View></View>;
}

export function Upcoming({ icon, color, title, subtitle, amount, theme, onPress, onDone }: { icon: string; color: string; title: string; subtitle: string; amount: string; theme: Theme; onPress?: () => void; onDone: () => void }) {
  return <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={[styles.expenseRow, { borderColor: theme.line }]}><View style={[styles.bubble, { backgroundColor: `${color}22` }]}><Glyph name={icon} color={color} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemName, { color: theme.text }]}>{title}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{subtitle}</AppText></View><AppText style={[styles.amount, { color: theme.text }]}>{amount}</AppText><TouchableOpacity onPress={onDone} style={{ padding: 5, marginLeft: 4 }}><MaterialIcons name="done" size={20} color={theme.green} /></TouchableOpacity></TouchableOpacity>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.statBox}><AppText style={styles.statValue}>{value}</AppText><AppText style={styles.statLabel}>{label}</AppText></View>;
}

export function RingBudget({ pct, color, bg }: { pct: number; color: string; bg: string }) {
  const size = 236;
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, pct)));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={bg} strokeWidth={15} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={15}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
