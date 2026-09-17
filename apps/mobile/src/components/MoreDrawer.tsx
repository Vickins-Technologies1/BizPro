import React from "react";
import { Animated, BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AccessPermission } from "@shared";
import { hasPermission, resolveBusinessTypeConfig } from "@shared";
import { useAppStore } from "@/store/useAppStore";
import { useThemeTokens } from "@/theme";

type MoreDrawerProps = {
  visible: boolean;
  currentRoute?: string | undefined;
  onClose: () => void;
  onNavigate: (routeName: string) => void;
};

type DrawerItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  routeName: string;
  permission?: AccessPermission;
};

const DRAWER_GROUPS: Array<{ title: string; items: DrawerItem[] }> = [
  {
    title: "Workspace",
    items: [
      { label: "Switch branch", icon: "layers-outline", routeName: "Launchpad" },
      { label: "Notifications", icon: "notifications-outline", routeName: "Notifications" }
    ]
  },
  {
    title: "Business",
    items: [
      { label: "Customers", icon: "people-outline", routeName: "Customers", permission: "manageCustomers" },
      { label: "Finance", icon: "cash-outline", routeName: "Finance", permission: "manageExpenses" },
      { label: "Expenses", icon: "receipt-outline", routeName: "Expenses", permission: "manageExpenses" },
      { label: "Brands", icon: "color-palette-outline", routeName: "Brands", permission: "manageInventory" },
      { label: "Suppliers", icon: "briefcase-outline", routeName: "Suppliers", permission: "manageSuppliers" },
      { label: "Purchase orders", icon: "document-text-outline", routeName: "PurchaseOrders", permission: "manageInventory" },
      { label: "Stock transfers", icon: "swap-horizontal-outline", routeName: "StockTransfers", permission: "manageInventory" },
      { label: "Branches", icon: "business-outline", routeName: "Branches", permission: "manageBranches" },
      { label: "Operations", icon: "briefcase-outline", routeName: "Operations", permission: "manageOperations" }
    ]
  },
  {
    title: "People & access",
    items: [
      { label: "Employees", icon: "people-outline", routeName: "Employees", permission: "manageEmployees" },
      { label: "Team access", icon: "shield-checkmark-outline", routeName: "TeamAccess", permission: "manageEmployees" }
    ]
  },
  {
    title: "Device",
    items: [{ label: "Settings", icon: "settings-outline", routeName: "Settings", permission: "manageSettings" }]
  }
];

export function MoreDrawer({ visible, currentRoute, onClose, onNavigate }: MoreDrawerProps) {
  const theme = useThemeTokens();
  const user = useAppStore((state) => state.user);
  const business = useAppStore((state) => state.business);
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const businessConfig = resolveBusinessTypeConfig({ businessType: business?.businessType, industryKey: business?.industryKey });
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = Math.min(360, Math.max(292, width - 24));
  const translateX = React.useRef(new Animated.Value(-drawerWidth)).current;
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setRendered(true);
      translateX.setValue(-drawerWidth);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220, mass: 0.8 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true })
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(translateX, { toValue: -drawerWidth, duration: 180, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: true })
    ]).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [backdropOpacity, drawerWidth, translateX, visible]);

  React.useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, visible]);

  if (!rendered) return null;
  const styles = createStyles(theme);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close more menu" />
      </Animated.View>
      <Animated.View style={[styles.drawer, { width: drawerWidth, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12), transform: [{ translateX }] }]}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="apps-outline" size={19} color={theme.colors.primaryStrong} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>More</Text>
            <Text style={styles.subtitle}>Business tools and access</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close more menu">
            <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.rule} />
        <View style={styles.groups}>
          {DRAWER_GROUPS.map((group) => {
            const items = group.items.filter((item) => (
              (!item.permission || hasPermission(user, item.permission)) &&
              isDrawerItemAvailable(item.routeName, businessConfig.capabilities)
            ));
            if (!items.length) return null;
            return (
              <View key={group.title} style={styles.group}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                <View style={styles.groupItems}>
                  {items.map((item) => {
                    const active = currentRoute === item.routeName;
                    return (
                      <Pressable
                        key={item.routeName}
                        onPress={() => {
                          onClose();
                          onNavigate(item.routeName);
                        }}
                        style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && styles.itemPressed]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Ionicons name={item.icon} size={19} color={active ? theme.colors.primaryStrong : theme.colors.textSecondary} />
                        <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{item.label}</Text>
                        <Ionicons name="chevron-forward" size={15} color={active ? theme.colors.primaryStrong : theme.colors.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
        <MobileThemeToggle
          themeMode={themeMode}
          onToggle={() => void setThemeMode(themeMode === "dark" ? "light" : "dark")}
        />
      </Animated.View>
    </View>
  );
}

function isDrawerItemAvailable(routeName: string, capabilities: Readonly<Record<string, boolean>>) {
  if (routeName === "Customers") return capabilities.customers;
  if (["Brands", "PurchaseOrders", "StockTransfers"].includes(routeName)) return capabilities.inventory || capabilities.purchasing;
  if (routeName === "Branches") return true;
  if (routeName === "Operations") return capabilities.orders || capabilities.appointments || capabilities.workOrders;
  return true;
}

function MobileThemeToggle({ themeMode, onToggle }: { themeMode: "light" | "dark"; onToggle: () => void }) {
  const theme = useThemeTokens();
  const isDark = themeMode === "dark";
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel="Toggle light and dark theme"
      style={({ pressed }) => ({
        marginTop: "auto",
        minHeight: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceAlt,
        opacity: pressed ? 0.82 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={17} color={theme.colors.primaryStrong} />
        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "900" }}>{isDark ? "Dark mode" : "Light mode"}</Text>
      </View>
      <Text style={{ color: theme.colors.primaryStrong, fontSize: 11, fontWeight: "900" }}>Switch</Text>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
  backdrop: { backgroundColor: theme.colors.overlay },
  drawer: {
    height: "100%",
    backgroundColor: theme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 22,
    shadowOffset: { width: 10, height: 0 },
    elevation: 18
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: `${theme.colors.primary}18` },
  headerCopy: { flex: 1, gap: 2 },
  title: { color: theme.colors.text, fontSize: 17, fontWeight: "900" },
  subtitle: { color: theme.colors.textMuted, fontSize: 11 },
  closeButton: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt },
  rule: { height: 1, backgroundColor: theme.colors.border, marginVertical: 14 },
  groups: { gap: 15 },
  group: { gap: 7 },
  groupTitle: { color: theme.colors.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.9, textTransform: "uppercase" },
  groupItems: { gap: 3 },
  item: { minHeight: 42, borderRadius: 12, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  itemActive: { backgroundColor: `${theme.colors.primary}18`, borderWidth: 1, borderColor: `${theme.colors.primaryStrong}55` },
  itemPressed: { opacity: 0.78 },
  itemLabel: { flex: 1, color: theme.colors.textSecondary, fontSize: 13, fontWeight: "700" },
  itemLabelActive: { color: theme.colors.primaryStrong, fontWeight: "900" }
  });
}
