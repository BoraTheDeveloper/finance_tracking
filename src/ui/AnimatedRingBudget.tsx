import { useEffect, useMemo, useRef } from "react";
import { Animated } from "react-native";
import Svg, { Circle, type SvgProps } from "react-native-svg";

import {
  MOTION_DURATION,
  MOTION_EASING,
  clamp01,
  shouldAnimate,
} from "./motion";
import { useReducedMotion } from "./useReducedMotion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type AnimatedRingBudgetProps = Omit<
  SvgProps,
  "children" | "height" | "viewBox" | "width"
> & {
  pct: number;
  color: string;
  bg: string;
  size?: number;
  radius?: number;
  strokeWidth?: number;
  duration?: number;
};

export function AnimatedRingBudget({
  pct,
  color,
  bg,
  size = 236,
  radius = 100,
  strokeWidth = 15,
  duration = MOTION_DURATION.ring,
  ...svgProps
}: AnimatedRingBudgetProps) {
  const reducedMotion = useReducedMotion();
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const targetOffset = circumference * (1 - clamp01(pct));
  const dashOffset = useRef(new Animated.Value(targetOffset)).current;

  useEffect(() => {
    dashOffset.stopAnimation();

    if (!shouldAnimate(reducedMotion, duration)) {
      dashOffset.setValue(targetOffset);
      return;
    }

    Animated.timing(dashOffset, {
      toValue: targetOffset,
      duration,
      easing: MOTION_EASING.decelerate,
      useNativeDriver: false,
    }).start();
  }, [dashOffset, duration, reducedMotion, targetOffset]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      {...svgProps}
    >
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={bg}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset as unknown as number}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
