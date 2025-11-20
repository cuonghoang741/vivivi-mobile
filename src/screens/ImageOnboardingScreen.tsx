import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button } from '../components/Button';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_IMAGES = [
  'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Onboarding/Frame%2032-min.png',
  'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Onboarding/Frame%2033-min.png',
  'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Onboarding/Frame%2034-min.png',
  'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Onboarding/Frame%2035-min.png',
];

type Props = {
  onComplete: () => void;
  onSkip: () => void;
};

export const ImageOnboardingScreen: React.FC<Props> = ({ onComplete, onSkip }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});
  const scrollViewRef = useRef<ScrollView>(null);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (currentPage < ONBOARDING_IMAGES.length - 1) {
      const nextPage = currentPage + 1;
      scrollViewRef.current?.scrollTo({
        x: SCREEN_WIDTH * nextPage,
        animated: true,
      });
      setCurrentPage(nextPage);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSkip();
  };

  return (
    <LinearGradient
      colors={['#FF8587', '#FF0066']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentPage(page);
        }}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {ONBOARDING_IMAGES.map((url, index) => (
          <View key={index} style={styles.imageContainer}>
            {imageLoading[index] !== false && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            )}
            <Image
              source={{ uri: url }}
              style={styles.image}
              onLoadStart={() => setImageLoading((prev) => ({ ...prev, [index]: true }))}
              onLoadEnd={() => setImageLoading((prev) => ({ ...prev, [index]: false }))}
              onError={() => setImageLoading((prev) => ({ ...prev, [index]: false }))}
              resizeMode="contain"
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomContent}>
        <View style={styles.dotsContainer}>
          {ONBOARDING_IMAGES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentPage && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <Button
            fullWidth
            onPress={handleContinue}
            size='lg'
          >
            {currentPage < ONBOARDING_IMAGES.length - 1 ? 'Continue' : 'Get Started'}
          </Button>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: Math.min(SCREEN_WIDTH - 40, 500),
    height: '100%',
    maxHeight: 600,
  },
  bottomContent: {
    paddingBottom: 50,
    paddingHorizontal: 24,
    gap: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    maxWidth: 300,
    alignSelf: 'center',
    width: '100%',
  },
});

