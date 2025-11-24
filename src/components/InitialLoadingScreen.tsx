import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';

type InitialLoadingScreenProps = {
  loading?: boolean;
  message?: string;
  error?: string | null;
  onRetry?: () => void;
};

export const InitialLoadingScreen: React.FC<InitialLoadingScreenProps> = ({
  loading = true,
  message = 'Loading...',
  error,
  onRetry,
}) => {
  const showError = !!error;
  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator size="large" color="#fff" /> : null}
      <Text style={styles.message}>{showError ? 'Unable to load initial data' : message}</Text>
      {showError ? (
        <>
          <Text style={styles.errorDetail}>{error}</Text>
          <Text style={styles.hint}>Check your network connection and try again.</Text>
          {onRetry ? (
            <Button onPress={onRetry} style={styles.retryButton}>
              Try Again
            </Button>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#000',
    gap: 16,
  },
  message: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorDetail: {
    color: '#ff8a8a',
    textAlign: 'center',
    fontSize: 14,
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    fontSize: 13,
  },
  retryButton: {
    paddingHorizontal: 24,
  },
});


