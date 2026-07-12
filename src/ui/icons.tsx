import { MaterialIcons } from "@expo/vector-icons";

export type IconName = keyof typeof MaterialIcons.glyphMap;

// Older persisted state (and pre-icon-picker categories) stored emoji; map them to
// Material Symbol names so the vector icons render consistently.
export const ICON_ALIASES: Record<string, IconName> = {
  "🍜": "restaurant",
  "🎬": "movie",
  "🚌": "directions-bus",
  "🧾": "receipt-long",
  "🛍️": "shopping-bag",
  "🛍": "shopping-bag",
  "➕": "medical-services",
  "✨": "category",
  "✈️": "flight",
  "✈": "flight",
  "👛": "account-balance-wallet",
  "🎯": "savings",
};

export function iconName(value: string): IconName {
  if (!value) return "category";
  if (value in ICON_ALIASES) return ICON_ALIASES[value];
  const normalized = value.replace(/_/g, "-") as IconName;
  return normalized in MaterialIcons.glyphMap ? normalized : "category";
}

export function Glyph({
  name,
  size = 22,
  color,
}: {
  name: string;
  size?: number;
  color: string;
}) {
  return <MaterialIcons name={iconName(name)} size={size} color={color} />;
}

// Full picker set from the design, filtered to icons that exist in MaterialIcons.
export const ICON_SET: IconName[] = (
  [
    "category",
    "restaurant",
    "local-cafe",
    "fastfood",
    "local-bar",
    "cake",
    "shopping-bag",
    "shopping-cart",
    "checkroom",
    "card-giftcard",
    "directions-bus",
    "directions-car",
    "local-gas-station",
    "train",
    "flight",
    "receipt-long",
    "bolt",
    "water-drop",
    "wifi",
    "phone-iphone",
    "movie",
    "sports-esports",
    "music-note",
    "fitness-center",
    "spa",
    "self-improvement",
    "medical-services",
    "medication",
    "pets",
    "school",
    "book",
    "home",
    "chair",
    "savings",
    "wallet",
    "work",
    "brush",
    "celebration",
  ] as IconName[]
).filter((n) => n in MaterialIcons.glyphMap);
