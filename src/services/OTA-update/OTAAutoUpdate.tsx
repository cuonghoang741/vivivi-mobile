import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { useOTAUpdate } from './useOTAUpdate';
import Button from '../../components/Button';

interface OTAAutoUpdateProps {
  onDismiss?: () => void;
}

export const OTAAutoUpdate: React.FC<OTAAutoUpdateProps> = ({ onDismiss }) => {
  const { updateInfo, isChecking, downloadAndInstallUpdate } = useOTAUpdate();
  const [visible, setVisible] = useState(false);
  const shimmerTranslate = useState(new Animated.Value(-200))[0];
  const isUpdating = updateInfo.isDownloading || updateInfo.isInstalling;

  useEffect(() => {
    if (updateInfo?.isAvailable) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [updateInfo?.isAvailable]);

  useEffect(() => {
    if (isUpdating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerTranslate, {
            toValue: 200,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(shimmerTranslate, {
            toValue: -200,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      shimmerTranslate.stopAnimation();
      shimmerTranslate.setValue(-200);
    }
  }, [isUpdating, shimmerTranslate]);

  if (!updateInfo.isAvailable && !isChecking && !visible) {
    return null;
  }

  const handleUpdate = () => {
    downloadAndInstallUpdate();
  };

  const handleClose = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Text style={styles.title}>New update available</Text>
          <Text style={styles.message}>
            Please update to enjoy the latest version.
          </Text>
          {(updateInfo.isDownloading || updateInfo.isInstalling) && (
            <View style={styles.progressRow}>
              <ActivityIndicator size="small" color="#0a7ea4" />
              <Text style={styles.progressText}>
                {updateInfo.isInstalling ? 'Installing update...' : 'Downloading update...'}
              </Text>
            </View>
          )}
          {isUpdating && updateInfo.downloadProgress === 0 && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarTrack}>
                <Animated.View
                  style={[
                    styles.progressBarShimmerWrapper,
                    { transform: [{ translateX: shimmerTranslate }] },
                  ]}
                >
                  <LinearGradient
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    colors={['#0a7ea430', '#0a7ea4', '#0a7ea430']}
                    style={styles.progressBarShimmer}
                  />
                </Animated.View>
              </View>
            </View>
          )}
          {isUpdating && updateInfo.downloadProgress > 0 && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${Math.min(updateInfo.downloadProgress, 1) * 100}%` }]}>
                  <LinearGradient
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    colors={['#0a7ea4', '#17a6c4']}
                    style={styles.progressBarFillGradient}
                  />
                </View>
              </View>
            </View>
          )}
          <View style={styles.actions}>
            <View style={styles.actionItem}>
              <Button
                fullWidth
                size='lg'
                variant='solid'
                color='gray'
                onPress={handleClose}
                disabled={updateInfo.isDownloading || updateInfo.isInstalling}
              >
                <Text style={[styles.buttonText, styles.secondaryText]}>Close</Text>
              </Button>
            </View>
            <View style={styles.actionItem}>
              <Button
                fullWidth
                size='lg'
                variant='solid'
                color='gray'
                onPress={handleUpdate}
                disabled={updateInfo.isDownloading || updateInfo.isInstalling}
              >
                <Text style={[styles.buttonText, styles.primaryText]}>
                  {updateInfo.isDownloading || updateInfo.isInstalling ? 'Updating...' : 'Update'}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#444',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#0a0a0a',
  },
  progressBarContainer: {
    width: '100%',
    marginBottom: 12,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#eef2f7',
    overflow: 'hidden',
  },
  progressBarShimmerWrapper: {
    width: '60%',
    height: '100%',
  },
  progressBarShimmer: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFillGradient: {
    width: '100%',
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 8,
    width: '100%',
    marginTop: 16,
  },
  actionItem: {
    flex: 1,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primary: {
    backgroundColor: '#0a7ea4',
  },
  primaryText: {
    color: '#fff',
  },
  secondary: {
    backgroundColor: '#eef2f7',
  },
  secondaryText: {
    color: '#0a0a0a',
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
