import React, { useCallback, useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Button from '../commons/Button';
import { ModalLiquidGlass } from '../commons/ModalLiquidGlass';

export type ConfirmPurchaseType =
  | {
    type: 'simple';
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    autoCloseOnSuccess?: boolean;
  }
  | {
    type: 'currency-choice';
    title: string;
    itemName: string;
    priceVcoin: number;
    priceRuby: number;
    balanceVcoin: number;
    balanceRuby: number;
    previewImage?: string | null;
    onConfirm: (choice: { useVcoin: boolean; useRuby: boolean }) => void;
    onCancel: () => void;
    onTopUp: (choice: { useVcoin: boolean; useRuby: boolean }) => void;
    autoCloseOnSuccess?: boolean;
  };

type ConfirmPurchaseModalProps = {
  visible: boolean;
  purchase: ConfirmPurchaseType | null;
  onClose: () => void;
};

const formatNumber = (value: number) =>
  value.toLocaleString('en-US', { maximumFractionDigits: 0 });

export const ConfirmPurchaseModal: React.FC<ConfirmPurchaseModalProps> = ({
  visible,
  purchase,
  onClose,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const shouldAutoClose = purchase?.autoCloseOnSuccess !== false;

  useEffect(() => {
    if (!visible) {
      setIsProcessing(false);
    }
  }, [visible]);

  useEffect(() => {
    setIsProcessing(false);
  }, [purchase]);
  const handleConfirm = useCallback(async () => {
    if (!purchase || purchase.type !== 'simple' || isProcessing) return;
    try {
      setIsProcessing(true);
      await Promise.resolve(purchase.onConfirm());
      if (shouldAutoClose) {
        onClose();
      }
    } catch (error) {
      setIsProcessing(false);
    }
  }, [purchase, onClose, isProcessing, shouldAutoClose]);

  const handleCancel = useCallback(() => {
    if (!purchase) return;
    if (purchase.type === 'simple') {
      purchase.onCancel();
    } else {
      purchase.onCancel();
    }
    onClose();
  }, [purchase, onClose]);

  const handleCurrencyChoice = useCallback(
    async (useVcoin: boolean, useRuby: boolean) => {
      if (!purchase || purchase.type !== 'currency-choice' || isProcessing) return;

      const canAfford = useVcoin
        ? purchase.balanceVcoin >= purchase.priceVcoin
        : purchase.balanceRuby >= purchase.priceRuby;

      if (canAfford) {
        try {
          setIsProcessing(true);
          await Promise.resolve(purchase.onConfirm({ useVcoin, useRuby }));
          if (shouldAutoClose) {
            onClose();
          }
        } catch (error) {
          setIsProcessing(false);
        }
      } else {
        // Show insufficient funds alert
        const currencyName = useVcoin ? 'VCoin' : 'Ruby';
        const required = useVcoin ? purchase.priceVcoin : purchase.priceRuby;
        const balance = useVcoin ? purchase.balanceVcoin : purchase.balanceRuby;

        Alert.alert(
          `Insufficient ${currencyName}`,
          `You don't have enough ${currencyName} to purchase this item.\n\nRequired: ${formatNumber(required)} ${currencyName}\nYou have: ${formatNumber(balance)} ${currencyName}`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                onClose();
              },
            },
            {
              text: 'Top Up',
              onPress: () => {
                purchase.onTopUp({ useVcoin, useRuby });
                onClose();
              },
            },
          ]
        );
      }
    },
    [purchase, onClose, isProcessing, shouldAutoClose]
  );

  const currencyChoiceContent = useMemo(() => {
    if (!purchase || purchase.type !== 'currency-choice') return null;

    const {
      itemName,
      priceVcoin,
      priceRuby,
      balanceVcoin,
      balanceRuby,
      previewImage,
    } =
      purchase;

    const hasVcoinPrice = priceVcoin > 0;
    const hasRubyPrice = priceRuby > 0;
    const canAffordVcoin = hasVcoinPrice && balanceVcoin >= priceVcoin;
    const canAffordRuby = hasRubyPrice && balanceRuby >= priceRuby;

    return (
      <View style={styles.currencyChoiceContainer}>
        <View style={styles.previewCard}>
          {previewImage ? (
            <Image source={{ uri: previewImage }} style={styles.previewImageThumb} />
          ) : (
            <View style={styles.previewIcon}>
              <Ionicons name="cube-outline" size={20} color="#1d1d1f" />
            </View>
          )}
          <View style={styles.previewText}>
            <Text style={styles.previewTitle}>{itemName}</Text>
            <Text style={styles.previewSubtitle}>
              {[
                hasVcoinPrice ? `${formatNumber(priceVcoin)} VCoin` : null,
                hasRubyPrice ? `${formatNumber(priceRuby)} Ruby` : null,
              ]
                .filter(Boolean)
                .join(' • ')}
            </Text>
          </View>
        </View>

        <View style={styles.currencyOptions}>
          {hasVcoinPrice && (
            <Pressable
              style={[
                styles.currencyOption,
                canAffordVcoin && styles.currencyOptionEnabled,
                !canAffordVcoin && styles.currencyOptionDisabled,
                isProcessing && styles.currencyOptionDisabled,
              ]}
              onPress={() => handleCurrencyChoice(true, false)}
              disabled={!canAffordVcoin || isProcessing}
            >
              <View style={styles.currencyOptionContent}>
                <View style={styles.currencyHeader}>
                  <Text style={styles.currencyLabel}>VCoin</Text>
                  {canAffordVcoin ? (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  ) : (
                    <View style={styles.crossmark}>
                      <Text style={styles.crossmarkText}>✗</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.currencyPrice}>
                  {formatNumber(priceVcoin)} VCoin
                </Text>
                <Text style={styles.currencyBalance}>
                  You have: {formatNumber(balanceVcoin)} VCoin
                </Text>
              </View>
            </Pressable>
          )}

          {hasRubyPrice && (
            <Pressable
              style={[
                styles.currencyOption,
                canAffordRuby && styles.currencyOptionEnabled,
                !canAffordRuby && styles.currencyOptionDisabled,
                isProcessing && styles.currencyOptionDisabled,
              ]}
              onPress={() => handleCurrencyChoice(false, true)}
              disabled={!canAffordRuby || isProcessing}
            >
              <View style={styles.currencyOptionContent}>
                <View style={styles.currencyHeader}>
                  <Text style={styles.currencyLabel}>Ruby</Text>
                  {canAffordRuby ? (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  ) : (
                    <View style={styles.crossmark}>
                      <Text style={styles.crossmarkText}>✗</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.currencyPrice}>
                  {formatNumber(priceRuby)} Ruby
                </Text>
                <Text style={styles.currencyBalance}>
                  You have: {formatNumber(balanceRuby)} Ruby
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>
    );
  }, [purchase, handleCurrencyChoice]);

  if (!purchase || !visible) {
    return null;
  }

  return (
    <ModalLiquidGlass
      visible={visible && !!purchase}
      onRequestClose={handleCancel}
      disableBackgroundDismiss={isProcessing}
    >
      <View style={styles.content} pointerEvents={isProcessing ? 'none' : 'auto'}>
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.title}>{purchase.title}</Text>
            {purchase.type === 'simple' ? (
              <Text style={styles.subtitle}>Review before confirming</Text>
            ) : (
              <Text style={styles.subtitle}>Preview the content you’re unlocking</Text>
            )}
          </View>
          <Pressable
            style={[styles.closeButton, isProcessing && styles.closeButtonDisabled]}
            onPress={handleCancel}
            disabled={isProcessing}
          >
            <Ionicons name="close" size={16} color="#111" />
          </Pressable>
        </View>

        {purchase.type === 'simple' ? (
          <View style={styles.simpleBody}>
            <View style={styles.simpleIcon}>
              <Ionicons name="sparkles-sharp" size={22} color="#111" />
            </View>
            <Text style={styles.message}>{purchase.message}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.currencyHint}>
              Choose a currency to unlock this item
            </Text>
            {currencyChoiceContent}
          </>
        )}

        {purchase.type === 'simple' ? (
          <View style={styles.buttons}>
            <Button
              variant="liquid"
              size="lg"
              onPress={handleConfirm}
              style={styles.button}
              disabled={isProcessing}
              loading={isProcessing}
            >
              Confirm Purchase
            </Button>
          </View>
        ) : (
          <Text style={styles.tipText}>
            Tip: You can tap any currency option above to complete your purchase instantly.
          </Text>
        )}

        {isProcessing ? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.processingText}>Processing order…</Text>
          </View>
        ) : null}
      </View>
    </ModalLiquidGlass>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleGroup: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f0f0f',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#4d4d4d',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonDisabled: {
    opacity: 0.4,
  },
  message: {
    fontSize: 16,
    color: '#1a1a1a',
    textAlign: 'left',
  },
  simpleBody: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  simpleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffe9a7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
  },
  currencyHint: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginBottom: 16,
  },
  currencyChoiceContainer: {
    marginBottom: 18,
    gap: 16,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  previewImageThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  previewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffe0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  previewSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#5a5a5a',
  },
  currencyOptions: {
    gap: 12,
  },
  currencyOption: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  currencyOptionEnabled: {
    borderColor: 'rgba(17, 17, 17, 0.12)',
  },
  currencyOptionDisabled: {
    borderColor: 'rgba(255, 0, 0, 0.25)',
    opacity: 0.5,
  },
  currencyOptionContent: {
    padding: 16,
    gap: 6,
  },
  currencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  currencyLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    letterSpacing: 0.2,
  },
  checkmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '700',
  },
  crossmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossmarkText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '700',
  },
  currencyPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  currencyBalance: {
    fontSize: 14,
    color: '#5c5c5c',
  },
  tipText: {
    marginTop: 12,
    fontSize: 12,
    color: '#5a5a5a',
    textAlign: 'center',
  },
  processingOverlay: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  processingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

