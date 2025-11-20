import React from 'react';
import { View, Text, Image, StyleSheet, ImageStyle, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LiquidGlass } from '../LiquidGlass';
import type { CharacterItem } from '../../repositories/CharacterRepository';

type CharacterCardProps = {
  item: CharacterItem;
  isOwned: boolean;
  style?: ViewStyle;
};

const ProBadge = ({ tier }: { tier?: string }) => {
  if (!tier || tier === 'free') return null;
  
  return (
    <View style={styles.proBadge}>
      <Text style={styles.proBadgeText}>{tier.toUpperCase()}</Text>
    </View>
  );
};

const PriceBadgesView = ({ vcoin, ruby }: { vcoin?: number; ruby?: number }) => {
  return (
    <View style={styles.priceBadges}>
      {vcoin ? (
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>V {vcoin}</Text>
        </View>
      ) : null}
      {ruby ? (
        <View style={[styles.priceBadge, styles.rubyBadge]}>
          <Text style={styles.priceBadgeText}>R {ruby}</Text>
        </View>
      ) : null}
    </View>
  );
};

const LockIcon = () => (
  <View style={styles.lockIconContainer}>
    <View style={styles.lockIcon}>
      <Text style={styles.lockIconText}>🔒</Text>
    </View>
  </View>
);

export const CharacterCard: React.FC<CharacterCardProps> = ({ item, isOwned, style }) => {
  const hasPrice = !isOwned && ((item.price_vcoin ?? 0) > 0 || (item.price_ruby ?? 0) > 0);

  return (
    <View style={[styles.card, style, !isOwned && styles.cardDimmed]}>
      <View style={styles.imageContainer}>
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder} />
        )}
        
        {/* Dark overlay for unowned */}
        {!isOwned && <View style={styles.darkenOverlay} />}
        
        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.gradient}
        />
        
        {/* Top-left badges */}
        <View style={styles.topLeftBadges}>
          {!isOwned && (
            <View style={styles.ageBadge}>
              <Text style={styles.ageBadgeText}>18+</Text>
            </View>
          )}
          {hasPrice && (
            <PriceBadgesView vcoin={item.price_vcoin} ruby={item.price_ruby} />
          )}
        </View>
        
        {/* Lock icon center */}
        {!isOwned && <LockIcon />}
        
        {/* Bottom content */}
        <View style={styles.bottomContent}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            <ProBadge tier={item.tier} />
          </View>
          {item.description ? (
            <Text style={styles.description} numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  cardDimmed: {
    opacity: 0.5,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  darkenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  topLeftBadges: {
    position: 'absolute',
    top: 6,
    left: 10,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  ageBadge: {
    backgroundColor: 'rgba(128,128,153,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  ageBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  priceBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  priceBadge: {
    backgroundColor: 'rgba(255,149,0,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  rubyBadge: {
    backgroundColor: 'rgba(255,0,100,0.9)',
  },
  priceBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  proBadge: {
    backgroundColor: 'rgba(160,104,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  lockIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIconText: {
    fontSize: 24,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  name: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  description: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
});

