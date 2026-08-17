import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface AddressSearchBarProps {
  onSearch: (address: string) => void;
  isLoading: boolean;
}

export function AddressSearchBar({ onSearch, isLoading }: AddressSearchBarProps) {
  const [address, setAddress] = useState('');

  const handleSubmit = () => {
    const trimmed = address.trim();
    if (trimmed.length > 0) {
      onSearch(trimmed);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Enter destination address"
        value={address}
        onChangeText={setAddress}
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
        editable={!isLoading}
      />
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={isLoading}>
        <Text style={styles.buttonText}>{isLoading ? '...' : 'Search'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  button: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
