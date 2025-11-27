import React, { useCallback, useMemo } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewProps,
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

  const energyColor =
    energyRatio < 0.2 ? "#FF4F5E" : energyRatio < 0.5 ? "#FFA533" : "#FFD24D";

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, safeAreaPadding, style]}
      {...rest}
    >
      <View style={styles.leftColumn}>
        <ButtonTile onPress={onLevelPress}>
          <View style={styles.levelCompactRow}>
            <Text style={styles.levelLabel}>{`LV. ${level}`}</Text>
            <View style={styles.levelCompactTrack}>
              <LinearGradient
                colors={["#FF247C", "#FF247C"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.levelCompactFill,
                  { width: `${levelProgress * 100}%` },
                ]}
              />
            </View>
          </View>
        </ButtonTile>

        <ButtonTile onPress={onEnergyPress}>
          <View style={styles.energyRow}>
            <Ionicons name="flash" size={14} color="#111" />
            <Text style={styles.energyLabel}>{`${energy}/${energyMax}`}</Text>
          </View>
        </ButtonTile>

        <ButtonTile onPress={handleCurrencyPress}>
          <CurrencyRow icon={VCOIN_ICON} amount={animatedBalance.vcoin} />
        </ButtonTile>
        <ButtonTile onPress={handleCurrencyPress}>
          <CurrencyRow icon={RUBY_ICON} amount={animatedBalance.ruby} />
        </ButtonTile>
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
}> = ({ icon, amount }) => (
  <View style={styles.currencyRow}>
    <Image source={icon} style={styles.currencyIcon} />
    <Text style={styles.currencyLabel}>{formatCompactCurrency(amount)}</Text>
  </View>
);

type IoniconName = keyof typeof Ionicons.glyphMap;

const IconButton: React.FC<{
  iconName: IoniconName;
  onPress?: () => void;
  highlight?: boolean;
}> = ({ iconName, onPress, highlight }) => (
  <Pressable
    onPress={onPress}
    style={[styles.iconButton, highlight && styles.iconButtonHighlight]}
  >
    <LiquidGlass style={styles.iconButtonGlass} pressable={false}>
      <Ionicons name={iconName} size={18} color="#111" />
    </LiquidGlass>
  </Pressable>
);

const ButtonTile: React.FC<{
  children: React.ReactNode;
  onPress?: () => void;
}> = ({ children, onPress }) => (
  <Button variant="liquid" style={styles.tilePressable} onPress={onPress}>
    <View style={styles.tileContentRow}>{children}</View>
  </Button>
);

const formatCompactCurrency = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }

  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return `${value}`;
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  leftColumn: {
    gap: 12,
    width: "auto",
    alignSelf: "flex-start",
  },
  rightColumn: {
    alignItems: "flex-end",
    gap: 10,
  },
  tilePressable: {
    borderRadius: 22,
    minHeight: 44,
    alignSelf: "flex-start",
  },
  tileContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  levelLabel: {
    color: "#111",
    fontSize: 14,
    fontWeight: "700",
  },
  levelCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelCompactTrack: {
    width: 86,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 10,
    overflow: "hidden",
  },
  levelCompactFill: {
    height: "100%",
    borderRadius: 10,
  },
  energyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  energyLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
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
    color: "#111",
    fontSize: 14,
    fontWeight: "700",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonHighlight: {
    backgroundColor: "rgba(255,149,0,0.18)",
  },
  pressed: {
    opacity: 0.85,
  },
});
