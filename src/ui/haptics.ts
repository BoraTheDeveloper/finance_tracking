import * as Haptics from 'expo-haptics';

async function safely(run: () => Promise<void>) {
  try {
    await run();
  } catch {
    // Haptics are best-effort only; finance actions must never fail because
    // a device/browser declined tactile feedback.
  }
}

export function hapticSelect() {
  void safely(() => Haptics.selectionAsync());
}

export function hapticSuccess() {
  void safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticWarning() {
  void safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function hapticError() {
  void safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
