import { useMemo } from 'react';
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
import { useLocaleStrings } from '../i18n/useLocaleStrings';
import { raisedSurface, insetBorder } from '../theme/styleHelpers';
import { useThemePalette } from '../theme/useThemePalette';
import type { ThemeName, ThemePalette } from '../theme/types';

export interface SoftUpdateDialogProps {
  updateInfo: UpdateInfo;
  onUpdatePress: () => void;
  onLaterPress: () => void;
  title?: string;
  message?: string;
  updateButtonLabel?: string;
  laterButtonLabel?: string;
  /** Named style variant, resolved against the OS color scheme. Defaults to 'default' (the original claymorphism look). */
  theme?: ThemeName;
  /** Overrides device-locale auto-detection for the default title/message/button labels (doc 06 §4). Has no effect on any prop you pass explicitly. */
  locale?: string;
  /**
   * Called instead of onUpdatePress when updateInfo.recommendedChannel === 'ota' (doc
   * 06 §2) — wire this to your own OTA client (e.g. `Updates.reloadAsync()`,
   * `CodePush.sync()`); this library never imports one itself. Omit to always fall back
   * to onUpdatePress, today's behavior.
   */
  onOtaUpdateAvailable?: (info: UpdateInfo) => void | Promise<void>;
}

/** Dismissible modal dialog (Prompt 1 §5.3; UI copy detail is Prompt 19). */
export function SoftUpdateDialog({
  updateInfo,
  onUpdatePress,
  onLaterPress,
  title,
  message,
  updateButtonLabel,
  laterButtonLabel,
  theme = 'default',
  locale,
  onOtaUpdateAvailable,
}: SoftUpdateDialogProps): ReactElement {
  const palette = useThemePalette(theme);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const strings = useLocaleStrings(locale).softUpdate;
  const effectiveTitle = title ?? strings.title;
  const effectiveMessage =
    message ??
    strings.message(updateInfo.latestVersion, updateInfo.releaseNotes);
  const effectiveUpdateButtonLabel =
    updateButtonLabel ?? strings.updateButtonLabel;
  const effectiveLaterButtonLabel =
    laterButtonLabel ?? strings.laterButtonLabel;
  const handleUpdatePress = (): void => {
    if (updateInfo.recommendedChannel === 'ota' && onOtaUpdateAvailable) {
      onOtaUpdateAvailable(updateInfo);
      return;
    }
    onUpdatePress();
  };

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

          <View style={styles.iconBadge}>
            <Text style={styles.iconGlyph}>✦</Text>
          </View>

          <Text style={styles.title}>{effectiveTitle}</Text>
          <Text style={styles.message}>{effectiveMessage}</Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.primaryButtonPressed : null,
            ]}
            onPress={handleUpdatePress}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonLabel}>
              {effectiveUpdateButtonLabel}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={onLaterPress}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonLabel}>
              {effectiveLaterButtonLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: palette.backdrop,
      justifyContent: 'flex-end',
    },
    card: {
      borderTopLeftRadius: palette.radius.card,
      borderTopRightRadius: palette.radius.card,
      paddingHorizontal: 24,
      paddingTop: 14,
      paddingBottom: Platform.select({ ios: 34, default: 20 }),
      alignItems: 'center',
      ...raisedSurface(palette, palette.surface, palette.cardShadow, {
        offset: { width: 0, height: -4 },
        opacity: 0.35,
        radius: 14,
        elevation: 10,
      }),
    },
    handle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: palette.surfaceRecessed,
      marginBottom: 18,
    },
    iconBadge: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      ...raisedSurface(palette, palette.secondary, palette.secondaryShadow, {
        offset: { width: 4, height: 4 },
        opacity: 0.4,
        radius: 8,
        elevation: 6,
      }),
    },
    iconGlyph: { fontSize: 24, color: palette.onSecondary },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: palette.textMuted,
      textAlign: 'center',
      marginBottom: 24,
    },
    primaryButton: {
      width: '100%',
      paddingVertical: 16,
      borderRadius: palette.radius.button,
      alignItems: 'center',
      marginBottom: 10,
      ...raisedSurface(palette, palette.primary, palette.primaryShadow, {
        offset: { width: 4, height: 4 },
        opacity: 0.4,
        radius: 8,
        elevation: 6,
      }),
    },
    primaryButtonPressed: {
      backgroundColor: palette.primaryPressed,
    },
    primaryButtonLabel: {
      color: palette.onPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryButton: {
      width: '100%',
      paddingVertical: 13,
      borderRadius: palette.radius.button,
      alignItems: 'center',
      ...insetBorder(palette),
    },
    secondaryButtonLabel: {
      color: palette.textMuted,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
