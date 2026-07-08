import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Dimensions,
  findNodeHandle,
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type KeyboardEvent,
  type ScrollViewProps,
} from 'react-native';

type MeasurableInput = {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

type TextInputState = {
  State?: {
    currentlyFocusedInput?: () => MeasurableInput | null;
  };
};

type KeyboardScrollResponder = {
  getScrollResponder?: () => KeyboardScrollResponder;
  scrollResponderScrollNativeHandleToKeyboard?: (nodeHandle: number, additionalOffset?: number, preventNegativeScrollOffset?: boolean) => void;
};

function keyboardResponder(scrollView: ScrollView | null) {
  const responder = scrollView as unknown as KeyboardScrollResponder | null;
  return responder?.getScrollResponder?.() ?? responder;
}

function focusedInput() {
  return (TextInput as unknown as TextInputState).State?.currentlyFocusedInput?.() ?? null;
}

function keyboardTop(event?: KeyboardEvent | null) {
  const screenY = event?.endCoordinates?.screenY;
  if (typeof screenY === 'number' && screenY > 0) return screenY;
  const keyboardHeight = event?.endCoordinates?.height ?? 0;
  return Dimensions.get('window').height - keyboardHeight;
}

export function KeyboardAwareScrollView({
  children,
  extraSpace = 28,
  keyboardBottomInset = 0,
  contentContainerStyle,
  ...props
}: ScrollViewProps & { children: ReactNode; extraSpace?: number; keyboardBottomInset?: number }) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const latestKeyboardTop = useRef<number | null>(null);
  const scrollTimer = useRef<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  function scrollFocusedInputIntoView(event?: KeyboardEvent | null) {
    const input = focusedInput();
    if (!input) return;

    const nodeHandle = findNodeHandle(input as never);
    const responder = keyboardResponder(scrollRef.current);
    if (nodeHandle && responder?.scrollResponderScrollNativeHandleToKeyboard) {
      responder.scrollResponderScrollNativeHandleToKeyboard(nodeHandle, extraSpace, true);
      return;
    }

    if (!input.measureInWindow) return;
    const top = event ? keyboardTop(event) : latestKeyboardTop.current;
    if (top === null) return;

    input.measureInWindow((_x, y, _width, height) => {
      const overflow = y + height + extraSpace - top;
      if (overflow <= 0) return;
      scrollRef.current?.scrollTo({ y: scrollY.current + overflow, animated: true });
    });
  }

  function scheduleFocusedInputScroll(event?: KeyboardEvent | null) {
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    const delay = event ? (Platform.OS === 'ios' ? 90 : 120) : latestKeyboardTop.current === null ? 90 : 40;
    scrollTimer.current = window.setTimeout(() => {
      scrollTimer.current = null;
      scrollFocusedInputIntoView(event);
    }, delay);
  }

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      latestKeyboardTop.current = keyboardTop(event);
      setKeyboardVisible(true);
      scheduleFocusedInputScroll(event);
    });
    const frameSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillChangeFrame', (event) => {
          latestKeyboardTop.current = keyboardTop(event);
          setKeyboardVisible(true);
          scheduleFocusedInputScroll(event);
        })
      : null;
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      latestKeyboardTop.current = null;
      setKeyboardVisible(false);
    });
    return () => {
      if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
      showSub.remove();
      frameSub?.remove();
      hideSub.remove();
    };
  }, [extraSpace]);

  return (
    <ScrollView
      {...props}
      ref={scrollRef}
      contentContainerStyle={[contentContainerStyle, keyboardVisible && keyboardBottomInset > 0 ? { paddingBottom: keyboardBottomInset } : null]}
      onScroll={(event) => {
        scrollY.current = event.nativeEvent.contentOffset.y;
        props.onScroll?.(event);
      }}
      scrollEventThrottle={props.scrollEventThrottle ?? 16}
      onTouchEnd={(event) => {
        props.onTouchEnd?.(event);
        scheduleFocusedInputScroll(null);
      }}
    >
      {children}
    </ScrollView>
  );
}
