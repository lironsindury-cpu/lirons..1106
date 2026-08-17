import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Polyline, Region } from 'react-native-maps';
import { ScoredStreet } from '../types/parking.types';

interface ParkingStreetsMapProps {
  region: Region;
  streets: ScoredStreet[];
}

const COLOR_BY_POTENTIAL: Record<ScoredStreet['potential'], string> = {
  high: '#2ecc71',
  medium: '#f1c40f',
  low: '#e74c3c',
};

export function ParkingStreetsMap({ region, streets }: ParkingStreetsMapProps) {
  return (
    <MapView style={styles.map} region={region}>
      {streets.map((street) => (
        <Polyline
          key={street.id}
          coordinates={street.coordinates}
          strokeColor={COLOR_BY_POTENTIAL[street.potential]}
          strokeWidth={5}
          tappable
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
