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

export interface ForceUpdateScreenProps {
  updateInfo: UpdateInfo;
  onUpdatePress: () => void;
  title?: string;
  message?: string;
  updateButtonLabel?: string;
}

/**
 * Non-dismissible lockout, shown as a centered popup over a dimmed backdrop
 * (Prompt 1 §5.3; UI copy detail is Prompt 19). Unlike SoftUpdateDialog, the
 * backdrop is not tappable and onRequestClose is a no-op — there is no way to
 * dismiss this without calling onUpdatePress.
 */
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
      transparent
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconBadge, styles.blueRaised]}>
            <Text style={styles.iconGlyph}>⬆</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.versionRow}>
            <View style={[styles.inset, styles.versionChip]}>
              <Text style={styles.versionChipText}>
                {updateInfo.currentVersion}
              </Text>
            </View>
            <Text style={styles.versionArrow}>→</Text>
            <View style={[styles.versionChip, styles.sageRaised]}>
              <Text style={styles.versionChipLatestText}>
                {updateInfo.latestVersion}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed ? styles.coralPressed : styles.coralRaised,
            ]}
            onPress={onUpdatePress}
            accessibilityRole="button"
          >
            <Text style={styles.buttonLabel}>{updateButtonLabel}</Text>
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
const BLUE = '#67A2C5';
const SAGE = '#9BCEC1';

const shadow = (color: string) =>
  Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 6, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 10,
    },
    default: { elevation: 6 },
  });

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(58,42,30,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: BG,
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    ...shadow('#c9a97c'),
  },
  inset: {
    backgroundColor: RECESSED,
    borderWidth: 1,
    borderTopColor: SHADOW,
    borderLeftColor: SHADOW,
    borderBottomColor: HIGHLIGHT,
    borderRightColor: HIGHLIGHT,
  },
  blueRaised: {
    backgroundColor: BLUE,
    ...shadow('#4f7f9c'),
  },
  sageRaised: {
    backgroundColor: SAGE,
    ...shadow('#6ea393'),
  },
  coralRaised: {
    backgroundColor: CORAL,
    ...shadow('#e08a72'),
  },
  coralPressed: {
    backgroundColor: CORAL_PRESSED,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconGlyph: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginBottom: 22,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 26,
  },
  versionChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  versionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  versionChipLatestText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f4a3d',
  },
  versionArrow: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonLabel: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
