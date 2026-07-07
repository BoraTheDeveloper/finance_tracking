import { Easing } from 'react-native';

export const MOTION_DURATION = {
  press: 100,
  chip: 160,
  toast: 180,
  number: 280,
  ring: 320,
  screen: 280,
  sheet: 300,
  celebration: 700,
} as const;

export const MOTION_EASING = {
  standard: Easing.out(Easing.cubic),
  decelerate: Easing.out(Easing.quad),
  gentle: Easing.bezier(0.2, 0, 0, 1),
} as const;

export function clamp(value: number, min: number, max: number) {
  if (min > max) return clamp(value, max, min);
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number) {
  return clamp(value, 0, 1);
}

export function shouldAnimate(reducedMotion: boolean, duration: number) {
  return !reducedMotion && duration > 0;
}

export function motionDuration(duration: number, reducedMotion: boolean) {
  return shouldAnimate(reducedMotion, duration) ? duration : 0;
}
