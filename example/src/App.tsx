import { Button, StyleSheet, Text, View } from 'react-native';
import { useVersionManager } from '@rs-native-kit/version-check/ui';

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
