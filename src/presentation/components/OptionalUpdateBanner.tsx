import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactElement } from 'react';
import type { UpdateInfo } from '../../domain/models/UpdateInfo';

export interface OptionalUpdateBannerProps {
  updateInfo: UpdateInfo;
  onUpdatePress: () => void;
  onDismissPress: () => void;
  message?: string;
  updateButtonLabel?: string;
}

/** Low-intrusion in-app banner (Prompt 1 §5.3; UI copy detail is Prompt 19). */
export function OptionalUpdateBanner({
  updateInfo,
  onUpdatePress,
  onDismissPress,
  message = `Version ${updateInfo.latestVersion} is available.`,
  updateButtonLabel = 'Update',
}: OptionalUpdateBannerProps): ReactElement {
  return (
    <View style={styles.banner}>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        <Pressable onPress={onUpdatePress} accessibilityRole="button">
          <Text style={styles.updateLabel}>{updateButtonLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onDismissPress}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Text style={styles.dismissLabel}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#111827',
  },
  message: { color: '#ffffff', fontSize: 13, flexShrink: 1, marginRight: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  updateLabel: { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  dismissLabel: { color: '#9ca3af', fontSize: 13 },
});
