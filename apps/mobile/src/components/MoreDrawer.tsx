import React from "react";
import { Animated, BackHandler, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AccessPermission, WorkspaceRoute } from "@shared";
import { hasPermission, resolveBusinessTypeConfig } from "@shared";
import { useAppStore } from "@/store/useAppStore";
import { useThemeTokens } from "@/theme";

type MoreDrawerProps = {
  visible: boolean;
  currentRoute?: string | undefined;
  overflowRoutes?: WorkspaceRoute[];
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
    title: "Business management",
    items: [
      { label: "Customers", icon: "people-outline", routeName: "Customers", permission: "manageCustomers" },
      { label: "Finance", icon: "cash-outline", routeName: "Finance", permission: "manageExpenses" },
      { label: "Expenses", icon: "receipt-outline", routeName: "Expenses", permission: "manageExpenses" },
      { label: "Branches", icon: "business-outline", routeName: "Branches", permission: "manageBranches" },
      { label: "Operations", icon: "briefcase-outline", routeName: "Operations", permission: "manageOperations" }
    ]
  },
  {
    title: "Inventory & purchasing",
    items: [
      { label: "Brands", icon: "color-palette-outline", routeName: "Brands", permission: "manageInventory" },
      { label: "Suppliers", icon: "briefcase-outline", routeName: "Suppliers", permission: "manageSuppliers" },
      { label: "Purchase orders", icon: "document-text-outline", routeName: "PurchaseOrders", permission: "manageInventory" },
      { label: "Stock transfers", icon: "swap-horizontal-outline", routeName: "StockTransfers", permission: "manageInventory" }
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
    title: "Device & preferences",
    items: [{ label: "Settings", icon: "settings-outline", routeName: "Settings", permission: "manageSettings" }]
  }
];

export function MoreDrawer({ visible, currentRoute, overflowRoutes = [], onClose, onNavigate }: MoreDrawerProps) {
  const theme = useThemeTokens();
  const user = useAppStore((state) => state.user);
  const business = useAppStore((state) => state.business);
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
  const representedRoutes = new Set(DRAWER_GROUPS.flatMap((group) => group.items.map((item) => item.routeName)));
  const overflowItems = overflowRoutes
    .filter((routeName) => !representedRoutes.has(routeName))
    .map((routeName) => toOverflowItem(routeName, businessConfig));
  const groups = overflowItems.length
    ? [{ title: "More work areas", items: overflowItems }, ...DRAWER_GROUPS]
    : DRAWER_GROUPS;

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
        <ScrollView style={styles.scroll} contentContainerStyle={styles.groups} showsVerticalScrollIndicator={false}>
          {groups.map((group) => {
            const items = group.items.filter((item) => (
              isDrawerItemAuthorized(item, user) &&
              isDrawerItemAvailable(item.routeName, businessConfig)
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
                        <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{drawerItemLabel(item, businessConfig)}</Text>
                        <Ionicons name="chevron-forward" size={15} color={active ? theme.colors.primaryStrong : theme.colors.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function toOverflowItem(routeName: WorkspaceRoute, config: ReturnType<typeof resolveBusinessTypeConfig>): DrawerItem {
  const itemByRoute: Partial<Record<WorkspaceRoute, DrawerItem>> = {
    Dashboard: { label: "Dashboard", icon: "grid-outline", routeName },
    POS: { label: config.navigation.posLabel, icon: "scan-outline", routeName, permission: "createSales" },
    Catalog: { label: config.navigation.catalogLabel, icon: "cube-outline", routeName, permission: "manageInventory" },
    Customers: { label: config.navigation.customersLabel, icon: "people-outline", routeName, permission: "manageCustomers" },
    Employees: { label: config.terminology.staff, icon: "people-outline", routeName, permission: "manageEmployees" },
    Reports: { label: "Reports", icon: "bar-chart-outline", routeName, permission: "viewReports" },
    Finance: { label: "Finance", icon: "cash-outline", routeName, permission: "manageExpenses" },
    Insights: { label: "Insights", icon: "analytics-outline", routeName, permission: "viewReports" },
    Settings: { label: "Settings", icon: "settings-outline", routeName, permission: "manageSettings" },
    Operations: { label: config.workspace.activityLabel, icon: "briefcase-outline", routeName, permission: "manageOperations" }
  };
  return itemByRoute[routeName] ?? { label: routeName, icon: "apps-outline", routeName };
}

function isDrawerItemAvailable(routeName: string, config: ReturnType<typeof resolveBusinessTypeConfig>) {
  const capabilities = config.capabilities;
  if (routeName === "Finance") return capabilities.payments;
  if (routeName === "Customers") return capabilities.customers;
  if (routeName === "Catalog") return capabilities.catalog;
  if (routeName === "POS") return capabilities.pos;
  if (routeName === "Brands") return capabilities.inventory;
  if (["PurchaseOrders", "StockTransfers"].includes(routeName)) return capabilities.inventory || capabilities.purchasing;
  if (routeName === "Suppliers") return capabilities.suppliers;
  if (routeName === "Branches") return true;
  if (routeName === "Operations") return capabilities.orders || capabilities.appointments || capabilities.workOrders || capabilities.projects || capabilities.tasks;
  return true;
}

function isDrawerItemAuthorized(item: DrawerItem, user: ReturnType<typeof useAppStore.getState>["user"]) {
  if (item.routeName === "POS") return hasPermission(user, "createSales") || hasPermission(user, "manageSales");
  if (item.routeName === "Catalog") return hasPermission(user, "manageInventory") || hasPermission(user, "addProducts");
  if (item.routeName === "Finance") return hasPermission(user, "manageExpenses") || hasPermission(user, "viewReports");
  if (item.routeName === "Operations") return ["manageOperations", "manageAppointments", "manageBookings", "manageTables", "manageWorkOrders", "managePharmacy", "dispenseMedicines"]
    .some((permission) => hasPermission(user, permission as AccessPermission));
  return !item.permission || hasPermission(user, item.permission);
}

function drawerItemLabel(item: DrawerItem, config: ReturnType<typeof resolveBusinessTypeConfig>) {
  if (item.routeName === "Customers") return config.navigation.customersLabel;
  if (item.routeName === "Employees") return config.terminology.staff;
  if (item.routeName === "Operations") return config.workspace.activityLabel;
  return item.label;
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
  scroll: { flex: 1 },
  groups: { gap: 11, paddingBottom: 8 },
  group: { gap: 5 },
  groupTitle: { color: theme.colors.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.9, textTransform: "uppercase" },
  groupItems: { gap: 3 },
  item: { minHeight: 40, borderRadius: 10, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  itemActive: { backgroundColor: `${theme.colors.primary}18`, borderWidth: 1, borderColor: `${theme.colors.primaryStrong}55` },
  itemPressed: { opacity: 0.78 },
  itemLabel: { flex: 1, color: theme.colors.textSecondary, fontSize: 13, fontWeight: "700" },
  itemLabelActive: { color: theme.colors.primaryStrong, fontWeight: "900" }
  });
}
