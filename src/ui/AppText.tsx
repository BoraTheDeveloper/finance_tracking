import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { JAKARTA_TO_KHMER } from '../theme/typography';

const KHMER_RANGE = /[ក-៿᧠-᧿]/;

function hasKhmer(node: ReactNode): boolean {
  if (typeof node === 'string' || typeof node === 'number') return KHMER_RANGE.test(String(node));
  if (Array.isArray(node)) return node.some(hasKhmer);
  return false;
}

// Drop-in Text that renders Khmer content (the riel sign, etc.) in Kantumruy Pro
// while leaving Latin content in Plus Jakarta Sans.
export function AppText({ style, children, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) as { fontFamily?: string } | undefined;
  const family = flat?.fontFamily;
  const khmerStyle = family && hasKhmer(children) && JAKARTA_TO_KHMER[family] ? { fontFamily: JAKARTA_TO_KHMER[family] } : null;
  return <Text style={[style, khmerStyle]} {...rest}>{children}</Text>;
}
