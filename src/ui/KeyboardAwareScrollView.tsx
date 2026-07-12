import type { ReactNode } from "react";
import type { ScrollViewProps } from "react-native";
import { KeyboardAwareScrollView as KeyboardControllerScrollView } from "react-native-keyboard-controller";

// Native keyboard-aware scrolling via react-native-keyboard-controller.
// Requires <KeyboardProvider> at the app root. `extraSpace` is the gap kept
// between the focused input and the top of the keyboard.
export function KeyboardAwareScrollView({
  children,
  extraSpace = 28,
  ...props
}: ScrollViewProps & { children: ReactNode; extraSpace?: number }) {
  return (
    <KeyboardControllerScrollView
      bottomOffset={extraSpace}
      keyboardShouldPersistTaps="handled"
      {...props}
    >
      {children}
    </KeyboardControllerScrollView>
  );
}
