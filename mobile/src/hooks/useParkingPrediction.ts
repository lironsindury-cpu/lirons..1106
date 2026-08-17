import { useCallback, useState } from 'react';
import { fetchParkingPrediction } from '../services/api.service';
import { ParkingPredictionResponse } from '../types/parking.types';

interface UseParkingPredictionState {
  data: ParkingPredictionResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function useParkingPrediction() {
  const [state, setState] = useState<UseParkingPredictionState>({
    data: null,
    isLoading: false,
    error: null,
  });

  const search = useCallback(async (address: string) => {
    setState({ data: null, isLoading: true, error: null });
    try {
      const data = await fetchParkingPrediction(address);
      setState({ data, isLoading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      setState({ data: null, isLoading: false, error: message });
    }
  }, []);

  return { ...state, search };
}
