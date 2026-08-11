import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactElement } from 'react';
import type { UpdateInfo } from '../../domain/models/UpdateInfo';
import { useLocaleStrings } from '../i18n/useLocaleStrings';
import { raisedSurface, insetBorder } from '../theme/styleHelpers';
import { useThemePalette } from '../theme/useThemePalette';
import type { ThemeName, ThemePalette } from '../theme/types';

export interface ForceUpdateScreenProps {
  updateInfo: UpdateInfo;
  onUpdatePress: () => void;
  title?: string;
  message?: string;
  updateButtonLabel?: string;
  /** Named style variant, resolved against the OS color scheme. Defaults to 'default' (the original claymorphism look). */
  theme?: ThemeName;
  /** Overrides device-locale auto-detection for the default title/message/updateButtonLabel (doc 06 §4). Has no effect on any prop you pass explicitly. */
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
 * Non-dismissible lockout, shown as a centered popup over a dimmed backdrop
 * (Prompt 1 §5.3; UI copy detail is Prompt 19). Unlike SoftUpdateDialog, the
 * backdrop is not tappable and onRequestClose is a no-op — there is no way to
 * dismiss this without calling onUpdatePress.
 */
export function ForceUpdateScreen({
  updateInfo,
  onUpdatePress,
  title,
  message,
  updateButtonLabel,
  theme = 'default',
  locale,
  onOtaUpdateAvailable,
}: ForceUpdateScreenProps): ReactElement {
  const palette = useThemePalette(theme);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const strings = useLocaleStrings(locale).forceUpdate;
  const effectiveTitle = title ?? strings.title;
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
    <Modal
      visible
      animationType="fade"
      transparent
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconGlyph}>⬆</Text>
          </View>

          <Text style={styles.title}>{effectiveTitle}</Text>
          <Text style={styles.message}>{effectiveMessage}</Text>

          <View style={styles.versionRow}>
            <View style={styles.versionChip}>
              <Text style={styles.versionChipText}>
                {updateInfo.currentVersion}
              </Text>
            </View>
            <Text style={styles.versionArrow}>→</Text>
            <View style={styles.versionChipLatest}>
              <Text style={styles.versionChipLatestText}>
                {updateInfo.latestVersion}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed ? styles.buttonPressed : null,
            ]}
            onPress={handleUpdatePress}
            accessibilityRole="button"
          >
            <Text style={styles.buttonLabel}>{effectiveUpdateButtonLabel}</Text>
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
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      borderRadius: palette.radius.card,
      paddingVertical: 32,
      paddingHorizontal: 28,
      alignItems: 'center',
      ...raisedSurface(palette, palette.surface, palette.cardShadow, {
        offset: { width: 6, height: 6 },
        opacity: 0.45,
        radius: 10,
        elevation: 6,
      }),
    },
    iconBadge: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      ...raisedSurface(palette, palette.info, palette.infoShadow, {
        offset: { width: 6, height: 6 },
        opacity: 0.45,
        radius: 10,
        elevation: 6,
      }),
    },
    iconGlyph: {
      fontSize: 28,
      color: palette.onPrimary,
      fontWeight: '700',
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      lineHeight: 21,
      color: palette.textMuted,
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
      ...insetBorder(palette),
    },
    versionChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.textMuted,
    },
    versionChipLatest: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 999,
      ...raisedSurface(palette, palette.secondary, palette.secondaryShadow, {
        offset: { width: 4, height: 4 },
        opacity: 0.4,
        radius: 8,
        elevation: 6,
      }),
    },
    versionChipLatestText: {
      fontSize: 13,
      fontWeight: '700',
      color: palette.onSecondary,
    },
    versionArrow: {
      fontSize: 14,
      color: palette.textMuted,
    },
    button: {
      width: '100%',
      paddingVertical: 16,
      borderRadius: palette.radius.button,
      alignItems: 'center',
      ...raisedSurface(palette, palette.primary, palette.primaryShadow, {
        offset: { width: 4, height: 4 },
        opacity: 0.4,
        radius: 8,
        elevation: 6,
      }),
    },
    buttonPressed: {
      backgroundColor: palette.primaryPressed,
    },
    buttonLabel: { color: palette.onPrimary, fontSize: 16, fontWeight: '700' },
  });
}
