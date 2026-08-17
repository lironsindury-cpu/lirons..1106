import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Region } from 'react-native-maps';
import { AddressSearchBar } from '../components/AddressSearchBar';
import { ParkingStreetsMap } from '../components/ParkingStreetsMap';
import { useParkingPrediction } from '../hooks/useParkingPrediction';

const DEFAULT_REGION: Region = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export function ParkingMapScreen() {
  const { data, isLoading, error, search } = useParkingPrediction();

  const region: Region = useMemo(() => {
    if (!data) return DEFAULT_REGION;
    return {
      latitude: data.destination.coordinates.latitude,
      longitude: data.destination.coordinates.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [data]);

  return (
    <View style={styles.container}>
      <AddressSearchBar onSearch={search} isLoading={isLoading} />
      {error && <Text style={styles.error}>{error}</Text>}
      {isLoading && <ActivityIndicator style={styles.loader} size="large" />}
      <ParkingStreetsMap region={region} streets={data?.streets ?? []} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  error: {
    color: '#e74c3c',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -18,
    marginTop: -18,
    zIndex: 10,
  },
});
