import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactElement } from 'react';
import type { UpdateInfo } from '../../domain/models/UpdateInfo';

export interface SoftUpdateDialogProps {
  updateInfo: UpdateInfo;
  onUpdatePress: () => void;
  onLaterPress: () => void;
  title?: string;
  message?: string;
  updateButtonLabel?: string;
  laterButtonLabel?: string;
}

/** Dismissible modal dialog (Prompt 1 §5.3; UI copy detail is Prompt 19). */
export function SoftUpdateDialog({
  updateInfo,
  onUpdatePress,
  onLaterPress,
  title = 'Update Available',
  message = `Version ${updateInfo.latestVersion} is available.${updateInfo.releaseNotes ? ` ${updateInfo.releaseNotes}` : ''}`,
  updateButtonLabel = 'Update',
  laterButtonLabel = 'Later',
}: SoftUpdateDialogProps): ReactElement {
  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={onLaterPress}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={onLaterPress}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonLabel}>
                {laterButtonLabel}
              </Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={onUpdatePress}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonLabel}>{updateButtonLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 14, marginBottom: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  secondaryButton: { paddingVertical: 10, paddingHorizontal: 16 },
  secondaryButtonLabel: { color: '#6b7280', fontSize: 15, fontWeight: '600' },
  primaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  primaryButtonLabel: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});
