import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text as RNText, Platform } from 'react-native';
import { Host, VStack, Text, Button, Switch, TextField, CircularProgress, LinearProgress } from '@expo/ui/swift-ui';
import { SwiftUIButton } from '../components/commons/SwiftUIButton';
import { SwiftUISwitch } from '../components/commons/SwiftUISwitch';
import { SwiftUITextField } from '../components/commons/SwiftUITextField';
import { SwiftUIBottomSheet } from '../components/commons/SwiftUIBottomSheet';

/**
 * Demo screen showing various SwiftUI components
 * Note: This requires a development build, not Expo Go
 */
export const SwiftUIDemoScreen: React.FC = () => {
  const [switchValue, setSwitchValue] = useState(false);
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [progress, setProgress] = useState(0.5);

  if (Platform.OS !== 'ios') {
    return (
      <View style={styles.container}>
        <RNText style={styles.errorText}>
          SwiftUI components are only available on iOS
        </RNText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <RNText style={styles.title}>SwiftUI Components Demo</RNText>
      <RNText style={styles.subtitle}>
        These components use native SwiftUI with liquid glass effects on iOS 26+
      </RNText>

      {/* Buttons */}
      <View style={styles.section}>
        <RNText style={styles.sectionTitle}>Buttons</RNText>
        <Host style={styles.hostContainer}>
          <VStack spacing={12}>
            <Button variant="default" onPress={() => console.log('Default pressed')}>
              Default Button
            </Button>
            <Button variant="bordered" onPress={() => console.log('Bordered pressed')}>
              Bordered Button
            </Button>
            <Button variant="borderedProminent" onPress={() => console.log('Bordered Prominent pressed')}>
              Bordered Prominent
            </Button>
            <Button variant="plain" onPress={() => console.log('Plain pressed')}>
              Plain Button
            </Button>
            <Button
              variant="default"
              systemImage="heart.fill"
              onPress={() => console.log('With icon pressed')}
            >
              Button with Icon
            </Button>
          </VStack>
        </Host>
      </View>

      {/* Switches */}
      <View style={styles.section}>
        <RNText style={styles.sectionTitle}>Switches & Toggles</RNText>
        <Host style={styles.hostContainer}>
          <VStack spacing={12}>
            <Switch
              value={switchValue}
              onValueChange={setSwitchValue}
              label="Enable notifications"
              variant="switch"
            />
            <Switch
              value={checkboxValue}
              onValueChange={setCheckboxValue}
              label="Accept terms"
              variant="checkbox"
            />
          </VStack>
        </Host>
      </View>

      {/* Text Field */}
      <View style={styles.section}>
        <RNText style={styles.sectionTitle}>Text Field</RNText>
        <Host style={styles.hostContainer}>
          <TextField
            defaultValue={textValue}
            placeholder="Enter text here..."
            onChangeText={setTextValue}
            autocorrection={false}
          />
        </Host>
        <RNText style={styles.hint}>Value: {textValue || '(empty)'}</RNText>
      </View>

      {/* Progress Indicators */}
      <View style={styles.section}>
        <RNText style={styles.sectionTitle}>Progress Indicators</RNText>
        <Host style={styles.hostContainer}>
          <VStack spacing={16}>
            <CircularProgress progress={progress} color="blue" />
            <LinearProgress progress={progress} color="red" />
          </VStack>
        </Host>
        <RNText style={styles.hint}>Progress: {(progress * 100).toFixed(0)}%</RNText>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.section}>
        <RNText style={styles.sectionTitle}>Bottom Sheet</RNText>
        <SwiftUIButton
          title="Open Bottom Sheet"
          onPress={() => setBottomSheetOpen(true)}
          variant="borderedProminent"
        />
        <SwiftUIBottomSheet
          isOpened={bottomSheetOpen}
          onIsOpenedChange={setBottomSheetOpen}
          title="SwiftUI Bottom Sheet"
        >
          <Host style={styles.hostContainer}>
            <VStack spacing={12}>
              <Text>This is a native SwiftUI Bottom Sheet</Text>
              <Button variant="default" onPress={() => setBottomSheetOpen(false)}>
                Close
              </Button>
            </VStack>
          </Host>
        </SwiftUIBottomSheet>
      </View>

      {/* Custom Components */}
      <View style={styles.section}>
        <RNText style={styles.sectionTitle}>Custom Wrapped Components</RNText>
        <SwiftUIButton
          title="Custom Button"
          onPress={() => console.log('Custom button pressed')}
          variant="default"
          systemImage="star.fill"
        />
        <View style={styles.spacing} />
        <SwiftUISwitch
          label="Custom Switch"
          checked={switchValue}
          onValueChange={setSwitchValue}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  hostContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    minHeight: 50,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  spacing: {
    height: 12,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    padding: 20,
  },
});

