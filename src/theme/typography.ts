// Plus Jakarta Sans — the primary (Latin/English) type family.
export const FONT = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

// Kantumruy Pro — used for Khmer script (e.g. the riel sign ៛). Kantumruy has no
// 800 weight, so the extrabold tier maps to its 700 Bold.
export const KHMER_FONT = {
  regular: 'KantumruyPro_400Regular',
  medium: 'KantumruyPro_500Medium',
  semibold: 'KantumruyPro_600SemiBold',
  bold: 'KantumruyPro_700Bold',
  extrabold: 'KantumruyPro_700Bold',
};

// Maps each Jakarta family to its Kantumruy counterpart so a Khmer-bearing string
// keeps its weight while switching script family. RN has no CSS-style per-glyph
// fallback, so we route the whole Text node.
export const JAKARTA_TO_KHMER: Record<string, string> = {
  [FONT.regular]: KHMER_FONT.regular,
  [FONT.medium]: KHMER_FONT.medium,
  [FONT.semibold]: KHMER_FONT.semibold,
  [FONT.bold]: KHMER_FONT.bold,
  [FONT.extrabold]: KHMER_FONT.extrabold,
};
