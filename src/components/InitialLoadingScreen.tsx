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
  message = 'Đang tải dữ liệu cá nhân từ Supabase...',
  error,
  onRetry,
}) => {
  const showError = !!error;
  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator size="large" color="#fff" /> : null}
      <Text style={styles.message}>{showError ? 'Không thể tải dữ liệu' : message}</Text>
      {showError ? (
        <>
          <Text style={styles.errorDetail}>{error}</Text>
          <Text style={styles.hint}>Kiểm tra kết nối mạng rồi thử lại.</Text>
          {onRetry ? (
            <Button onPress={onRetry} style={styles.retryButton}>
              Thử lại
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


