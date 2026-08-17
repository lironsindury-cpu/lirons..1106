import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { ParkingMapScreen } from './src/screens/ParkingMapScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ParkingMapScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
