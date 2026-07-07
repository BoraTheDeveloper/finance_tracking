import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';

import { MOTION_DURATION, MOTION_EASING, motionDuration } from './motion';
import { useReducedMotion } from './useReducedMotion';

type PressableStyle = PressableProps['style'];

export type AnimatedPressableProps = Omit<PressableProps, 'children'> & {
  children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
  contentStyle?: StyleProp<ViewStyle>;
  pressedOpacity?: number;
  pressedScale?: number;
  duration?: number;
};

export function AnimatedPressable({
  accessibilityState,
  children,
  contentStyle,
  disabled,
  duration = MOTION_DURATION.press,
  onPressIn,
  onPressOut,
  pressedOpacity = 0.92,
  pressedScale = 0.98,
  style,
  ...rest
}: AnimatedPressableProps) {
  const reducedMotion = useReducedMotion();
  const press = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (disabled) press.setValue(0);
  }, [disabled, press]);

  function animate(toValue: number) {
    if (disabled) return;
    Animated.timing(press, {
      toValue,
      duration: motionDuration(duration, reducedMotion),
      easing: MOTION_EASING.decelerate,
      useNativeDriver: true,
    }).start();
  }

  const scale = reducedMotion
    ? 1
    : press.interpolate({ inputRange: [0, 1], outputRange: [1, pressedScale] });
  const opacity = press.interpolate({ inputRange: [0, 1], outputRange: [1, pressedOpacity] });

  return (
    <Pressable
      {...rest}
      accessibilityState={disabled ? { ...accessibilityState, disabled: true } : accessibilityState}
      disabled={disabled}
      onPressIn={(event) => {
        animate(1);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animate(0);
        onPressOut?.(event);
      }}
      style={style as PressableStyle}
    >
      {(state) => (
        <Animated.View style={[contentStyle, { opacity, transform: [{ scale }] }]}>
          {typeof children === 'function' ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}
