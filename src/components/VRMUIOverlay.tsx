import React, { useCallback, useMemo } from "react";
import {
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import Button from "./Button";
import { LiquidGlass } from "./LiquidGlass";
import { usePurchaseContext } from "../context/PurchaseContext";

const VCOIN_ICON = require("../assets/images/VCoin.png");
const RUBY_ICON = require("../assets/images/Ruby.png");

type VRMUIOverlayProps = ViewProps & {
  level?: number;
  xp?: number;
  nextLevelXp?: number;
  energy?: number;
  energyMax?: number;
  hasIncompleteQuests?: boolean;
  canClaimCalendar?: boolean;
  hasMessages?: boolean;
  showChatList?: boolean;

  onLevelPress?: () => void;
  onEnergyPress?: () => void;
  onBackgroundPress?: () => void;
  onCostumePress?: () => void;
  onQuestPress?: () => void;
  onCalendarPress?: () => void;
  onToggleChatList?: () => void;
};

export const VRMUIOverlay: React.FC<VRMUIOverlayProps> = ({
  style,
  level = 1,
  xp = 0,
  nextLevelXp = 100,
  energy = 80,
  energyMax = 100,
  hasIncompleteQuests,
  canClaimCalendar,
  hasMessages,
  showChatList,
  onLevelPress,
  onEnergyPress,
  onBackgroundPress,
  onCostumePress,
  onQuestPress,
  onCalendarPress,
  onToggleChatList,
  ...rest
}) => {
  const { animatedBalance, setShowPurchaseSheet } = usePurchaseContext();

  const levelProgress = useMemo(() => {
    if (nextLevelXp <= 0) return 0;
    return Math.min(1, Math.max(0, xp / nextLevelXp));
  }, [xp, nextLevelXp]);

  const insets = useSafeAreaInsets();
  const safeAreaPadding = useMemo(
    () => ({
      paddingTop: 68 + insets.top,
      paddingBottom: 12 + insets.bottom,
    }),
    [insets.bottom, insets.top]
  );

  const energyRatio = useMemo(() => {
    if (energyMax <= 0) return 0;
    return Math.min(1, Math.max(0, energy / energyMax));
  }, [energy, energyMax]);

  const handleCurrencyPress = useCallback(() => {
    console.log("🔄 [VRMUIOverlay] Currency pressed, opening purchase sheet");
    setShowPurchaseSheet(true);
  }, [setShowPurchaseSheet]);

  const xpPercentLabel = `${Math.round(levelProgress * 100)}% XP`;
  const energyColor =
    energyRatio < 0.2 ? "#FF6B6B" : energyRatio < 0.5 ? "#FFC857" : "#8CF29C";

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, safeAreaPadding, style]}
      {...rest}
    >
      <View style={styles.leftColumn}>
        <GlassTile onPress={onLevelPress}>
          <View style={styles.levelHeader}>
            <Text style={styles.levelLabel}>{`LV. ${level}`}</Text>
            <Text style={styles.levelXpSmall}>{xpPercentLabel}</Text>
          </View>

          <View style={styles.levelProgressTrack}>
            <LinearGradient
              colors={["#FF9ACB", "#A068FF"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[
                styles.levelProgressFill,
                { width: `${levelProgress * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.levelXpLabel}>{`${xp}/${nextLevelXp} XP`}</Text>
        </GlassTile>

        <GlassTile onPress={onEnergyPress}>
          <View style={styles.energyRow}>
            <Ionicons name="flash" size={14} color={energyColor} />
            <Text
              style={[styles.energyLabel, { color: energyColor }]}
            >{`${energy}/${energyMax}`}</Text>
          </View>
        </GlassTile>

        <View style={styles.currencyStack}>
          <CurrencyRow
            icon={VCOIN_ICON}
            amount={animatedBalance.vcoin}
            onPress={handleCurrencyPress}
          />
          <CurrencyRow
            icon={RUBY_ICON}
            amount={animatedBalance.ruby}
            onPress={handleCurrencyPress}
          />
        </View>
      </View>

      <View style={styles.rightColumn}>
        <IconButton iconName="map-outline" onPress={onBackgroundPress} />
        <IconButton iconName="shirt-outline" onPress={onCostumePress} />
        <IconButton
          iconName="flag-outline"
          highlight={hasIncompleteQuests}
          onPress={onQuestPress}
        />
        <IconButton
          iconName="calendar-outline"
          highlight={canClaimCalendar}
          onPress={onCalendarPress}
        />
        {hasMessages ? (
          <IconButton
            iconName={
              showChatList ? "close-outline" : "chatbubble-ellipses-outline"
            }
            onPress={onToggleChatList}
          />
        ) : null}
      </View>
    </View>
  );
};

const CurrencyRow: React.FC<{
  icon: any;
  amount: number;
  onPress?: () => void;
}> = ({ icon, amount, onPress }) => (
  <LiquidGlass style={styles.currencyTile} onPress={onPress} pressable>
    <View
      style={styles.currencyRow}
    >
      <Image source={icon} style={styles.currencyIcon} />
      <Text style={styles.currencyLabel}>{amount.toLocaleString("en-US")}</Text>
    </View>
  </LiquidGlass>
);

type IoniconName = keyof typeof Ionicons.glyphMap;

const IconButton: React.FC<{
  iconName: IoniconName;
  onPress?: () => void;
  highlight?: boolean;
}> = ({ iconName, onPress, highlight }) => (
  <Button
    size="sm"
    variant="liquid"
    color="primary"
    isIconOnly
    startIconName={iconName}
    onPress={onPress}
    style={[styles.iconButton, highlight && styles.iconButtonHighlight]}
  />
);

const GlassTile: React.FC<{
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ children, onPress, style }) => (
  <LiquidGlass style={[styles.glassTile, style]} onPress={onPress} pressable>
    {children}
  </LiquidGlass>
);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  leftColumn: {
    gap: 10,
    maxWidth: "60%",
  },
  rightColumn: {
    alignItems: "flex-end",
    gap: 10,
  },
  glassTile: {
    borderRadius: 14,
    padding: 10,
  },
  tileContent: {
    gap: 6,
  },
  levelLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  levelXpSmall: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "600",
  },
  levelProgressTrack: {
    height: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
    overflow: "hidden",
  },
  levelProgressFill: {
    height: "100%",
    borderRadius: 6,
  },
  levelXpLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 4,
  },
  energyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  energyLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  currencyStack: {
    gap: 8,
  },
  currencyTile: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currencyIcon: {
    width: 18,
    height: 18,
    resizeMode: "contain",
  },
  currencyLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  iconButton: {
    width: 38,
    height: 38,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  iconButtonHighlight: {
    backgroundColor: "rgba(255,149,0,0.22)",
  },
  pressed: {
    opacity: 0.85,
  },
});
