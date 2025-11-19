import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert as RNAlert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { authManager } from '../../services/AuthManager';
import Button from '../Button';

type Props = {
  visible: boolean;
  onClose: () => void;
  email?: string | null;
  displayName?: string | null;
};

export const EditProfileView: React.FC<Props> = ({ visible, onClose, email, displayName }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      // Parse display name into first and last name
      if (displayName) {
        const parts = displayName.trim().split(/\s+/);
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
      } else {
        setFirstName('');
        setLastName('');
      }
      setBirthYear('');
    }
  }, [visible, displayName]);

  const displayInitial = useCallback(() => {
    const name = firstName || displayName || email?.split('@')[0] || 'U';
    return name.charAt(0).toUpperCase();
  }, [firstName, displayName, email]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      if (fullName.trim()) {
        // TODO: Implement updateDisplayName in AuthManager
        // await authManager.updateDisplayName(fullName);
        console.log('Would update display name to:', fullName);
      }
      if (birthYear) {
        // TODO: Implement updateBirthYear in AuthManager
        // await authManager.updateBirthYear(parseInt(birthYear));
        console.log('Would update birth year to:', birthYear);
      }
      onClose();
    } catch (error: any) {
      Alert.alert('Save Failed', error?.message ?? 'Please try again');
    } finally {
      setIsSaving(false);
    }
  }, [firstName, lastName, birthYear, onClose]);

  const handleDeleteAccount = useCallback(async () => {
    setIsDeleting(true);
    RNAlert.alert('Deleting Account', 'Please wait while we delete all your data. This may take a few moments...');
    try {
      // TODO: Implement deleteAccount in AuthManager
      // await authManager.deleteAccount();
      console.log('Would delete account');
      onClose();
      // After deletion, user will be logged out automatically
    } catch (error: any) {
      setIsDeleting(false);
      RNAlert.alert('Delete Failed', error?.message ?? 'Please try again');
    } finally {
      setIsDeleting(false);
    }
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Edit profile</Text>
          <Button variant="ghost" isIconOnly startIconName="close" onPress={onClose} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{displayInitial()}</Text>
            </View>
          </View>

          {/* Name Fields */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="First name"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <TextInput
              style={[styles.textInput, styles.textInputMargin]}
              placeholder="Last name"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>

          {/* Birth Year */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Birth Year</Text>
            <TouchableOpacity
              style={styles.birthYearButton}
              onPress={() => {
                // TODO: Show year picker
                Alert.alert('Birth Year', 'Year picker coming soon');
              }}
            >
              <Text style={styles.birthYearText}>
                {birthYear || 'Edit Birth Year'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Danger Zone */}
          <View style={styles.dangerZone}>
            <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                RNAlert.alert(
                  'Delete Account?',
                  'This will permanently delete your account. Your subscription cannot be recovered and will be cancelled immediately after deletion.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Continue',
                      style: 'destructive',
                      onPress: () => {
                        RNAlert.alert(
                          'Are you absolutely sure?',
                          'All data associated with your account will be removed. This action cannot be undone.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete Account',
                              style: 'destructive',
                              onPress: handleDeleteAccount,
                            },
                          ]
                        );
                      },
                    },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <Button
            variant="solid"
            color="primary"
            fullWidth
            onPress={handleSave}
            loading={isSaving}
          >
            Save
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '500',
  },
  fieldGroup: {
    gap: 10,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    color: '#fff',
    fontSize: 15,
  },
  textInputMargin: {
    marginTop: 12,
  },
  birthYearButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
  },
  birthYearText: {
    color: '#007AFF',
    fontSize: 15,
  },
  dangerZone: {
    gap: 12,
    paddingTop: 8,
  },
  dangerZoneTitle: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
});

