import { TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import type { Screen } from '../app/types';
import type { Theme } from '../theme/theme';
import { AppText } from './AppText';
import type { IconName } from './icons';
import { styles } from './styles';

export const NAV_ITEMS: readonly (readonly [Screen, IconName, string])[] = [
  ['home', 'home', 'Home'],
  ['categories', 'grid-view', 'Categories'],
  ['insights', 'insights', 'Insights'],
  ['settings', 'settings', 'Settings'],
];

export function BottomNav({ screen, theme, onGo }: { screen: Screen; theme: Theme; onGo: (screen: Screen) => void }) {
  return <View style={[styles.nav, { backgroundColor: theme.surface, borderColor: theme.line }]}>{NAV_ITEMS.slice(0, 2).map((item) => <NavItem key={item[0]} item={item} active={screen === item[0]} theme={theme} onGo={onGo} />)}<TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8 }]} onPress={() => onGo('add')}><MaterialIcons name="add" size={28} color="#fff" /></TouchableOpacity>{NAV_ITEMS.slice(2).map((item) => <NavItem key={item[0]} item={item} active={screen === item[0]} theme={theme} onGo={onGo} />)}</View>;
}

export function NavItem({ item, active, theme, onGo }: { item: readonly [Screen, IconName, string]; active: boolean; theme: Theme; onGo: (screen: Screen) => void }) {
  return <TouchableOpacity style={styles.navItem} onPress={() => onGo(item[0])}><View style={[styles.navIcon, { backgroundColor: active ? theme.primaryWash : 'transparent' }]}><MaterialIcons name={item[1]} size={23} color={active ? theme.primary : theme.muted} /></View><AppText style={[styles.navLabel, { color: active ? theme.primary : theme.muted }]}>{item[2]}</AppText></TouchableOpacity>;
}
