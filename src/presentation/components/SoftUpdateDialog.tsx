import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
        <Pressable style={StyleSheet.absoluteFill} onPress={onLaterPress} />
        <View style={styles.card}>
          <View style={styles.handle} />

          <View style={[styles.iconBadge, styles.sageRaised]}>
            <Text style={styles.iconGlyph}>✦</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.coralPressed : styles.coralRaised,
            ]}
            onPress={onUpdatePress}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonLabel}>{updateButtonLabel}</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, styles.inset]}
            onPress={onLaterPress}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonLabel}>{laterButtonLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const BG = '#FFEBD3';
const RECESSED = '#F3DAB9';
const TEXT = '#4A362B';
const TEXT_MUTED = '#9C8570';
const HIGHLIGHT = 'rgba(255,255,255,0.9)';
const SHADOW = 'rgba(196,150,102,0.45)';

const CORAL = '#FFB6A6';
const CORAL_PRESSED = '#F29A87';
const SAGE = '#9BCEC1';

const shadow = (color: string) =>
  Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
    },
    default: { elevation: 10 },
  });

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(58,42,30,0.5)',
    justifyContent: 'flex-end',
  },
  inset: {
    backgroundColor: RECESSED,
    borderWidth: 1,
    borderTopColor: SHADOW,
    borderLeftColor: SHADOW,
    borderBottomColor: HIGHLIGHT,
    borderRightColor: HIGHLIGHT,
  },
  sageRaised: {
    backgroundColor: SAGE,
    ...Platform.select({
      ios: {
        shadowColor: '#6ea393',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      default: { elevation: 6 },
    }),
  },
  coralRaised: {
    backgroundColor: CORAL,
    ...Platform.select({
      ios: {
        shadowColor: '#e08a72',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      default: { elevation: 6 },
    }),
  },
  coralPressed: {
    backgroundColor: CORAL_PRESSED,
  },
  card: {
    backgroundColor: BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: Platform.select({ ios: 34, default: 20 }),
    alignItems: 'center',
    ...shadow('#c9a97c'),
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: RECESSED,
    marginBottom: 18,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconGlyph: { fontSize: 24, color: '#1f4a3d' },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonLabel: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryButtonLabel: { color: TEXT_MUTED, fontSize: 15, fontWeight: '600' },
});
