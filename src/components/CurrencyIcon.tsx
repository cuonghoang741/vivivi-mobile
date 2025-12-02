import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const VCOIN_ICON = require('../assets/images/VCoin.png');
const RUBY_ICON = require('../assets/images/Ruby.png');

type CurrencyType = 'vcoin' | 'ruby' | 'xp' | 'bp';

type Props = {
  type: CurrencyType;
  size?: number;
};

export const CurrencyIcon: React.FC<Props> = ({ type, size = 20 }) => {
  const iconSource = type === 'vcoin' ? VCOIN_ICON : type === 'ruby' ? RUBY_ICON : null;

  if (iconSource) {
    return (
      <Image
        source={iconSource}
        style={[styles.icon, { width: size, height: size }]}
        resizeMode="contain"
      />
    );
  }

  // For XP and BP, we'll use a placeholder or you can add icons later
  return <View style={[styles.placeholder, { width: size, height: size }]} />;
};

const styles = StyleSheet.create({
  icon: {
    width: 20,
    height: 20,
  },
  placeholder: {
    backgroundColor: 'transparent',
  },
});

