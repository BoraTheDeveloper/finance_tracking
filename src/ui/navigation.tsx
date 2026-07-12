import { TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import type { Language, Screen } from "../app/types";
import { t, type TranslationKey } from "../app/i18n";
import type { Theme } from "../theme/theme";
import { AnimatedPressable } from "./AnimatedPressable";
import { AppText } from "./AppText";
import type { IconName } from "./icons";
import { styles } from "./styles";

export const NAV_ITEMS: readonly (readonly [
  Screen,
  IconName,
  TranslationKey,
])[] = [
  ["home", "home", "nav.home"],
  ["categories", "grid-view", "nav.categories"],
  ["insights", "insights", "nav.insights"],
  ["settings", "settings", "nav.settings"],
];

export function BottomNav({
  screen,
  theme,
  language,
  onGo,
}: {
  screen: Screen;
  theme: Theme;
  language: Language;
  onGo: (screen: Screen) => void;
}) {
  return (
    <View
      style={[
        styles.nav,
        { backgroundColor: theme.surface, borderColor: theme.line },
      ]}
    >
      {NAV_ITEMS.slice(0, 2).map((item) => (
        <NavItem
          key={item[0]}
          item={item}
          active={screen === item[0]}
          theme={theme}
          language={language}
          onGo={onGo}
        />
      ))}
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={t(language, "nav.addExpense")}
        accessibilityState={{ selected: screen === "add" }}
        style={[
          styles.fab,
          {
            backgroundColor: theme.primary,
            shadowColor: theme.primary,
            shadowOpacity: 0.4,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          },
        ]}
        onPress={() => onGo("add")}
      >
        <MaterialIcons name="add" size={28} color="#fff" />
      </AnimatedPressable>
      {NAV_ITEMS.slice(2).map((item) => (
        <NavItem
          key={item[0]}
          item={item}
          active={screen === item[0]}
          theme={theme}
          language={language}
          onGo={onGo}
        />
      ))}
    </View>
  );
}

export function NavItem({
  item,
  active,
  theme,
  language,
  onGo,
}: {
  item: readonly [Screen, IconName, TranslationKey];
  active: boolean;
  theme: Theme;
  language: Language;
  onGo: (screen: Screen) => void;
}) {
  const label = t(language, item[2]);
  return (
    <TouchableOpacity
      accessibilityRole="tab"
      accessibilityLabel={`${label} tab`}
      accessibilityState={{ selected: active }}
      style={styles.navItem}
      onPress={() => onGo(item[0])}
    >
      <View
        style={[
          styles.navIcon,
          { backgroundColor: active ? theme.primaryWash : "transparent" },
        ]}
      >
        <MaterialIcons
          name={item[1]}
          size={23}
          color={active ? theme.primary : theme.muted}
        />
      </View>
      <AppText
        style={[
          styles.navLabel,
          { color: active ? theme.primary : theme.muted },
        ]}
      >
        {label}
      </AppText>
    </TouchableOpacity>
  );
}
