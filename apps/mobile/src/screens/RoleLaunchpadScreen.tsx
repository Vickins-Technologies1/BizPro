import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { UserRole } from "@shared";
import { Badge, Card, Screen } from "@/components/Primitives";
import { useAppStore } from "@/store/useAppStore";
import { tokens } from "@/theme/tokens";

type DestinationKind = "tab" | "stack";

type Destination = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "primary" | "success" | "warning" | "danger";
  kind: DestinationKind;
  screen: string;
  tabScreen?: string;
  roles: UserRole[];
  recommended?: boolean;
};

const destinations: Destination[] = [
  {
    title: "Dashboard",
    subtitle: "View sales, profit, sync health, and quick actions.",
    icon: "grid-outline",
    tone: "primary",
    kind: "tab",
    screen: "Main",
    tabScreen: "Dashboard",
    roles: ["owner", "manager"]
  },
  {
    title: "Point of Sale",
    subtitle: "Start a sale, scan products, and complete checkout.",
    icon: "scan-outline",
    tone: "success",
    kind: "tab",
    screen: "Main",
    tabScreen: "POS",
    roles: ["owner", "manager", "cashier"],
    recommended: true
  },
  {
    title: "Catalog",
    subtitle: "Browse products, stock levels, and product detail.",
    icon: "cube-outline",
    tone: "primary",
    kind: "tab",
    screen: "Main",
    tabScreen: "Catalog",
    roles: ["owner", "manager"]
  },
  {
    title: "Customers",
    subtitle: "Open customer records and debt balances.",
    icon: "people-outline",
    tone: "primary",
    kind: "tab",
    screen: "Main",
    tabScreen: "Customers",
    roles: ["owner", "manager", "cashier"]
  },
  {
    title: "Insights",
    subtitle: "Review reports, trends, and business performance.",
    icon: "bar-chart-outline",
    tone: "warning",
    kind: "stack",
    screen: "Reports",
    roles: ["owner", "manager"]
  },
  {
    title: "Expenses",
    subtitle: "Record operating costs and expense history.",
    icon: "receipt-outline",
    tone: "danger",
    kind: "stack",
    screen: "Expenses",
    roles: ["owner", "manager"]
  },
  {
    title: "Settings",
    subtitle: "Check sync, device status, and sign out.",
    icon: "settings-outline",
    tone: "primary",
    kind: "stack",
    screen: "Settings",
    roles: ["owner", "manager", "cashier"]
  }
];

export function RoleLaunchpadScreen() {
  const navigation = useNavigation<any>();
  const user = useAppStore((state) => state.user);
  const business = useAppStore((state) => state.business);
  const role = (user?.role ?? "cashier") as UserRole;
  const styles = React.useMemo(() => createStyles(), [tokens]);
  const visibleDestinations = destinations.filter((destination) => destination.roles.includes(role));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={tokens.gradients.primary} style={styles.hero}>
          <View style={styles.heroGlowTop} />
          <View style={styles.heroGlowBottom} />
          <View style={styles.heroRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandLetter}>V</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Badge label={`${role} access`} tone="success" />
              <Text style={styles.heroTitle}>{business?.name ?? "Vickins Business OS"}</Text>
              <Text style={styles.heroSubtitle}>
                {user?.fullName ?? "Team member"} can jump straight into the areas allowed for this role.
              </Text>
            </View>
          </View>
        </LinearGradient>

        <Card style={styles.panel}>
          <Text style={styles.panelTitle}>Choose a workspace</Text>
          <Text style={styles.panelSubtitle}>
            Select the part of the app you want to open right now. The available destinations below are filtered for your role.
          </Text>
        </Card>

        <View style={styles.destinationList}>
          {visibleDestinations.map((destination) => {
            const accent = toneColors[destination.tone];
            return (
              <Pressable
                key={destination.title}
                onPress={() => {
                  if (destination.kind === "tab" && destination.tabScreen) {
                    navigation.navigate(destination.screen, { screen: destination.tabScreen });
                    return;
                  }
                  navigation.navigate(destination.screen);
                }}
                style={({ pressed }) => [styles.destinationPressable, pressed && styles.destinationPressed]}
              >
                <Card style={[styles.destinationCard, { borderColor: withAlpha(accent, 0.45) }]}>
                  <View style={[styles.destinationIcon, { backgroundColor: withAlpha(accent, 0.18) }]}>
                    <Ionicons name={destination.icon} size={22} color={accent} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.destinationHeadingRow}>
                      <Text style={styles.destinationTitle}>{destination.title}</Text>
                      {destination.recommended ? <Badge label="Recommended" tone="success" /> : null}
                    </View>
                    <Text style={styles.destinationSubtitle}>{destination.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={tokens.colors.textMuted} />
                </Card>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const toneColors = {
  primary: tokens.colors.primary,
  success: tokens.colors.success,
  warning: tokens.colors.warning,
  danger: tokens.colors.danger
} as const;

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const parsed = Number.parseInt(value, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createStyles() {
  return StyleSheet.create({
    content: {
      padding: 16,
      gap: 16,
      paddingBottom: 28
    },
    hero: {
      borderRadius: 28,
      padding: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: withAlpha(tokens.colors.primary, 0.18),
      minHeight: 190
    },
    heroGlowTop: {
      position: "absolute",
      top: -48,
      right: -24,
      width: 170,
      height: 170,
      borderRadius: 999,
      backgroundColor: withAlpha(tokens.colors.surface, 0.22)
    },
    heroGlowBottom: {
      position: "absolute",
      bottom: -80,
      left: -40,
      width: 220,
      height: 220,
      borderRadius: 999,
      backgroundColor: withAlpha(tokens.colors.primaryStrong, 0.18)
    },
    heroRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14
    },
    brandMark: {
      width: 68,
      height: 68,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: withAlpha(tokens.colors.text, 0.16),
      backgroundColor: withAlpha(tokens.colors.surface, 0.2),
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8
    },
    brandLetter: {
      color: tokens.colors.text,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: 1
    },
    heroTitle: {
      color: tokens.colors.text,
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: 0.3
    },
    heroSubtitle: {
      color: withAlpha(tokens.colors.text, 0.8),
      fontSize: 13,
      lineHeight: 18
    },
    panel: {
      gap: 8
    },
    panelTitle: {
      color: tokens.colors.text,
      fontSize: 18,
      fontWeight: "800"
    },
    panelSubtitle: {
      color: tokens.colors.textSecondary,
      lineHeight: 20
    },
    destinationList: {
      gap: 12
    },
    destinationPressable: {
      borderRadius: 24
    },
    destinationPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.99 }]
    },
    destinationCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderWidth: 1.5,
      borderRadius: 24
    },
    destinationIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center"
    },
    destinationHeadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    },
    destinationTitle: {
      color: tokens.colors.text,
      fontSize: 16,
      fontWeight: "800",
      flexShrink: 1
    },
    destinationSubtitle: {
      color: tokens.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18
    }
  });
}
