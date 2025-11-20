import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth, useCharacters, useBackgrounds, useCurrency } from '../hooks/useSupabase';

/**
 * Example component showing how to use Supabase repositories
 */
export const SupabaseExample: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { characters, loading: charsLoading, error: charsError } = useCharacters();
  const { backgrounds, loading: bgLoading, error: bgError } = useBackgrounds();
  const { balance, loading: currencyLoading, error: currencyError } = useCurrency();

  if (authLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>Authentication</Text>
        <Text>User: {user ? user.email || user.id : 'Not signed in'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Characters</Text>
        {charsLoading ? (
          <ActivityIndicator />
        ) : charsError ? (
          <Text style={styles.error}>Error: {charsError.message}</Text>
        ) : (
          <Text>Found {characters.length} characters</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Backgrounds</Text>
        {bgLoading ? (
          <ActivityIndicator />
        ) : bgError ? (
          <Text style={styles.error}>Error: {bgError.message}</Text>
        ) : (
          <Text>Found {backgrounds.length} backgrounds</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Currency</Text>
        {currencyLoading ? (
          <ActivityIndicator />
        ) : currencyError ? (
          <Text style={styles.error}>Error: {currencyError.message}</Text>
        ) : (
          <>
            <Text>VCoin: {balance.vcoin}</Text>
            <Text>Ruby: {balance.ruby}</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  error: {
    color: 'red',
  },
});

