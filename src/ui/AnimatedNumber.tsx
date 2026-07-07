import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, type TextProps } from 'react-native';

import { AppText } from './AppText';
import { MOTION_DURATION, MOTION_EASING, shouldAnimate } from './motion';
import { useReducedMotion } from './useReducedMotion';

export type AnimatedNumberProps = TextProps & {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  precision?: number;
};

export function AnimatedNumber({
  value,
  duration = MOTION_DURATION.number,
  format,
  precision = 0,
  ...textProps
}: AnimatedNumberProps) {
  const reducedMotion = useReducedMotion();
  const animated = useRef(new Animated.Value(value)).current;
  const [displayValue, setDisplayValue] = useState(value);

  const formatValue = useMemo(
    () => format ?? ((nextValue: number) => nextValue.toFixed(precision)),
    [format, precision],
  );

  useEffect(() => {
    const listenerId = animated.addListener(({ value: nextValue }) => {
      setDisplayValue(nextValue);
    });

    return () => {
      animated.removeListener(listenerId);
    };
  }, [animated]);

  useEffect(() => {
    animated.stopAnimation();

    if (!shouldAnimate(reducedMotion, duration)) {
      animated.setValue(value);
      setDisplayValue(value);
      return;
    }

    Animated.timing(animated, {
      toValue: value,
      duration,
      easing: MOTION_EASING.decelerate,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setDisplayValue(value);
    });
  }, [animated, duration, reducedMotion, value]);

  return <AppText {...textProps}>{formatValue(displayValue)}</AppText>;
}
