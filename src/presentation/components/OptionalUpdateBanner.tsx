import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactElement } from 'react';
import type { UpdateInfo } from '../../domain/models/UpdateInfo';

export interface OptionalUpdateBannerProps {
  updateInfo: UpdateInfo;
  onUpdatePress: () => void;
  onDismissPress: () => void;
  message?: string;
  updateButtonLabel?: string;
}

/**
 * Low-intrusion in-app banner (Prompt 1 §5.3; UI copy detail is Prompt 19). Renders
 * as a floating card, not an edge-to-edge bar — place it inside your own SafeAreaView
 * (or below a header) if you mount it at the very top/bottom of the screen, since this
 * component has no Modal/portal of its own and can't reserve safe-area space itself.
 */
export function OptionalUpdateBanner({
  updateInfo,
  onUpdatePress,
  onDismissPress,
  message = `Version ${updateInfo.latestVersion} is available.`,
  updateButtonLabel = 'Update',
}: OptionalUpdateBannerProps): ReactElement {
  return (
    <View style={[styles.banner, styles.raised]}>
      <View style={[styles.iconBadge, styles.blueRaised]}>
        <Text style={styles.iconGlyph}>↑</Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.updateButton,
            pressed ? styles.coralPressed : styles.coralRaised,
          ]}
          onPress={onUpdatePress}
          accessibilityRole="button"
        >
          <Text style={styles.updateLabel}>{updateButtonLabel}</Text>
        </Pressable>
        <Pressable
          style={[styles.dismissButton, styles.inset]}
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

const BG = '#FFEBD3';
const RECESSED = '#F3DAB9';
const TEXT = '#4A362B';
const HIGHLIGHT = 'rgba(255,255,255,0.9)';
const SHADOW = 'rgba(196,150,102,0.45)';

const CORAL = '#FFB6A6';
const CORAL_PRESSED = '#F29A87';
const BLUE = '#67A2C5';

const styles = StyleSheet.create({
  raised: {
    backgroundColor: BG,
    borderWidth: 1,
    borderTopColor: HIGHLIGHT,
    borderLeftColor: HIGHLIGHT,
    borderBottomColor: SHADOW,
    borderRightColor: SHADOW,
    ...Platform.select({
      ios: {
        shadowColor: '#c9a97c',
        shadowOffset: { width: 5, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      default: { elevation: 6 },
    }),
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
    ...Platform.select({
      ios: {
        shadowColor: '#4f7f9c',
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      default: { elevation: 4 },
    }),
  },
  coralRaised: {
    backgroundColor: CORAL,
    ...Platform.select({
      ios: {
        shadowColor: '#e08a72',
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      default: { elevation: 4 },
    }),
  },
  coralPressed: {
    backgroundColor: CORAL_PRESSED,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconGlyph: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  message: {
    flex: 1,
    color: TEXT,
    fontSize: 13,
    fontWeight: '500',
    marginRight: 12,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  updateButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  updateLabel: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  dismissButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissLabel: { color: '#9C8570', fontSize: 12 },
});
