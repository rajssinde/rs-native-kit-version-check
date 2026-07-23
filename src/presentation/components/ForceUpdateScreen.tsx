import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactElement } from 'react';
import type { UpdateInfo } from '../../domain/models/UpdateInfo';

export interface ForceUpdateScreenProps {
  updateInfo: UpdateInfo;
  onUpdatePress: () => void;
  title?: string;
  message?: string;
  updateButtonLabel?: string;
}

/** Full-screen, non-dismissible lockout (Prompt 1 §5.3; UI copy detail is Prompt 19). */
export function ForceUpdateScreen({
  updateInfo,
  onUpdatePress,
  title = 'Update Required',
  message = `Version ${updateInfo.latestVersion} is available. You must update to continue.`,
  updateButtonLabel = 'Update Now',
}: ForceUpdateScreenProps): ReactElement {
  return (
    <Modal
      visible
      animationType="fade"
      transparent={false}
      onRequestClose={() => undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable
          style={styles.button}
          onPress={onUpdatePress}
          accessibilityRole="button"
        >
          <Text style={styles.buttonLabel}>{updateButtonLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: { fontSize: 15, textAlign: 'center', marginBottom: 24 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  buttonLabel: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
