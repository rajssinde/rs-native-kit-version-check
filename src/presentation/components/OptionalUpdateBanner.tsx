import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactElement } from 'react';
import type { UpdateInfo } from '../../domain/models/UpdateInfo';
import { useLocaleStrings } from '../i18n/useLocaleStrings';
import {
  raisedBorder,
  raisedSurface,
  insetBorder,
} from '../theme/styleHelpers';
import { useThemePalette } from '../theme/useThemePalette';
import type { ThemeName, ThemePalette } from '../theme/types';

export interface OptionalUpdateBannerProps {
  updateInfo: UpdateInfo;
  onUpdatePress: () => void;
  onDismissPress: () => void;
  message?: string;
  updateButtonLabel?: string;
  /** Named style variant, resolved against the OS color scheme. Defaults to 'default' (the original claymorphism look). */
  theme?: ThemeName;
  /** Overrides device-locale auto-detection for the default message/updateButtonLabel (doc 06 §4). Has no effect on any prop you pass explicitly. */
  locale?: string;
  /**
   * Called instead of onUpdatePress when updateInfo.recommendedChannel === 'ota' (doc
   * 06 §2) — wire this to your own OTA client (e.g. `Updates.reloadAsync()`,
   * `CodePush.sync()`); this library never imports one itself. Omit to always fall back
   * to onUpdatePress, today's behavior.
   */
  onOtaUpdateAvailable?: (info: UpdateInfo) => void | Promise<void>;
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
  message,
  updateButtonLabel,
  theme = 'default',
  locale,
  onOtaUpdateAvailable,
}: OptionalUpdateBannerProps): ReactElement {
  const palette = useThemePalette(theme);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const strings = useLocaleStrings(locale).optionalBanner;
  const effectiveMessage = message ?? strings.message(updateInfo.latestVersion);
  const effectiveUpdateButtonLabel =
    updateButtonLabel ?? strings.updateButtonLabel;
  const handleUpdatePress = (): void => {
    if (updateInfo.recommendedChannel === 'ota' && onOtaUpdateAvailable) {
      onOtaUpdateAvailable(updateInfo);
      return;
    }
    onUpdatePress();
  };

  return (
    <View style={styles.banner}>
      <View style={styles.iconBadge}>
        <Text style={styles.iconGlyph}>↑</Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {effectiveMessage}
      </Text>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.updateButton,
            pressed ? styles.updateButtonPressed : null,
          ]}
          onPress={handleUpdatePress}
          accessibilityRole="button"
        >
          <Text style={styles.updateLabel}>{effectiveUpdateButtonLabel}</Text>
        </Pressable>
        <Pressable
          style={styles.dismissButton}
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

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 12,
      marginVertical: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 20,
      ...raisedBorder(palette, palette.cardShadow, {
        offset: { width: 5, height: 5 },
        opacity: 0.4,
        radius: 10,
        elevation: 6,
      }),
    },
    iconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      ...raisedSurface(palette, palette.info, palette.infoShadow, {
        offset: { width: 3, height: 3 },
        opacity: 0.4,
        radius: 6,
        elevation: 4,
      }),
    },
    iconGlyph: { color: palette.onPrimary, fontSize: 15, fontWeight: '700' },
    message: {
      flex: 1,
      color: palette.text,
      fontSize: 13,
      fontWeight: '500',
      marginRight: 12,
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    updateButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 999,
      ...raisedSurface(palette, palette.primary, palette.primaryShadow, {
        offset: { width: 3, height: 3 },
        opacity: 0.4,
        radius: 6,
        elevation: 4,
      }),
    },
    updateButtonPressed: {
      backgroundColor: palette.primaryPressed,
    },
    updateLabel: { color: palette.onPrimary, fontSize: 13, fontWeight: '700' },
    dismissButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      ...insetBorder(palette),
    },
    dismissLabel: { color: palette.textMuted, fontSize: 12 },
  });
}
