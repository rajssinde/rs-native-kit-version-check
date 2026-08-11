import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import {
  useVersionManager,
  SoftUpdateDialog,
} from '@rs-native-kit/version-check/ui';
import type { UpdateInfo } from '@rs-native-kit/version-check';

const THEME_SHOWCASE = false; // flip on to auto-cycle theme demo (see cli screenshot capture)

const SHOWCASE_THEMES = [
  'default',
  'appleStyle',
  'material3',
  'minimal',
] as const;
const SHOWCASE_INTERVAL_MS = 4000;

const SHOWCASE_UPDATE_INFO: UpdateInfo = {
  currentVersion: '1.4.0',
  latestVersion: '1.5.0',
  storeUrl: 'https://apps.apple.com/app/id284882215',
  releaseNotes: 'Performance improvements and bug fixes.',
  isForceUpdate: false,
  provider: 'apple',
  fetchedAt: Date.now(),
  recommendedChannel: 'binary',
};

function ThemeShowcase() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SHOWCASE_THEMES.length);
    }, SHOWCASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const theme = SHOWCASE_THEMES[index]!;

  console.log(`[ThemeShowcase] now showing: ${theme}`);

  return (
    <SoftUpdateDialog
      updateInfo={SHOWCASE_UPDATE_INFO}
      theme={theme}
      onUpdatePress={() => {}}
      onLaterPress={() => {}}
    />
  );
}

export default function App() {
  const { state, isUpdateAvailable, updateInfo, checkForUpdates } =
    useVersionManager({
      stores: {
        ios: { appStoreId: '284882215' },
        android: { packageName: 'com.example.app' },
      },
    });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Lifecycle state: {state}</Text>
      <Text style={styles.label}>
        Update available: {String(isUpdateAvailable)}
      </Text>
      {updateInfo ? (
        <Text style={styles.label}>
          Latest version: {updateInfo.latestVersion}
        </Text>
      ) : null}
      <View style={styles.button}>
        <Button
          title="Check for updates"
          onPress={() => {
            checkForUpdates();
          }}
        />
      </View>
      {THEME_SHOWCASE ? <ThemeShowcase /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { fontSize: 14 },
  button: { marginTop: 16 },
});
