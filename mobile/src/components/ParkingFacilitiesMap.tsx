import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { ScoredParkingFacility } from '../types/parking.types';

interface ParkingFacilitiesMapProps {
  region: Region;
  facilities: ScoredParkingFacility[];
}

const COLOR_BY_POTENTIAL: Record<ScoredParkingFacility['potential'], string> = {
  high: '#2ecc71',
  medium: '#f1c40f',
  low: '#e74c3c',
};

export function ParkingFacilitiesMap({ region, facilities }: ParkingFacilitiesMapProps) {
  return (
    <MapView style={styles.map} region={region}>
      {facilities.map((facility) => (
        <Marker
          key={facility.id}
          coordinate={{
            latitude: facility.location.latitude,
            longitude: facility.location.longitude,
          }}
          pinColor={COLOR_BY_POTENTIAL[facility.potential]}
          title={facility.name}
          description={facility.address}
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
