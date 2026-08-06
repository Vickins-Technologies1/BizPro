import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Badge, Card, GradientHeader, PrimaryButton, Screen } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { formatPermissionLabel, getEffectivePermissions, hasPermission } from "@shared";

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const themeMode = useAppStore((state) => state.themeMode);
  const syncNow = useAppStore((state) => state.syncNow);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const logout = useAppStore((state) => state.logout);
  const [syncing, setSyncing] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [savingTheme, setSavingTheme] = React.useState<"light" | "dark" | null>(null);
  const permissions = getEffectivePermissions(user);
  const canManageEmployees = hasPermission(user, "manageEmployees");
  const roleLabel = user?.roleLabel ?? formatRoleLabel(user?.role);

  return (
    <Screen>
      <GradientHeader
        title="Settings"
        subtitle="Business profile, sync status, and device security"
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Business snapshot</Text>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{business?.name}</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>{business?.businessType?.replaceAll("_", " ")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge label={`Plan ${business?.planTier?.toUpperCase()}`} tone="primary" />
            <Badge label={`Currency ${business?.currency}`} tone="success" />
            <Badge label={`Sync ${pendingSync}`} tone={pendingSync ? "warning" : "success"} />
            <Badge label={roleLabel} tone="primary" />
          </View>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Signed in as {user?.fullName ?? "Unknown"}. Use this page to check the device, change the theme, or open employee management.
          </Text>
        </Card>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Account access</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            {user?.role === "owner"
              ? "Owner accounts have full business control."
              : user?.role === "manager"
                ? "Manager accounts can run the business day to day with limited admin control."
                : "Employee accounts are trimmed down to operational work only."}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {permissions.slice(0, 6).map((permission) => (
              <Badge key={permission} label={formatPermissionLabel(permission)} tone="primary" />
            ))}
          </View>
          {canManageEmployees ? (
            <PrimaryButton title="Open employee workspace" variant="secondary" onPress={() => navigation.navigate("Employees")} />
          ) : null}
        </Card>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Theme</Text>
          <Text style={{ color: tokens.colors.textSecondary }}>Light mode is the default. Dark mode stays off unless you turn it on here.</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[
              { label: "Light", value: "light" as const },
              { label: "Dark", value: "dark" as const }
            ].map((option) => {
              const selected = themeMode === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setSavingTheme(option.value);
                    setThemeMode(option.value)
                      .catch((error) => {
                        Alert.alert("Theme update failed", error instanceof Error ? error.message : "Unable to save theme preference");
                      })
                      .finally(() => setSavingTheme(null));
                  }}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: selected ? tokens.colors.primaryStrong : tokens.colors.border,
                    backgroundColor: selected ? tokens.colors.primary : tokens.colors.surfaceAlt
                  }}
                >
                  <Text style={{ color: selected ? "#FFFFFF" : tokens.colors.text, fontWeight: "800" }}>{savingTheme === option.value ? "Saving..." : option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Device actions</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Keep the device in sync or sign out when you are done. These actions are always available here.
          </Text>
          <View style={{ gap: 10 }}>
            <PrimaryButton
              title={syncing ? "Syncing..." : "Sync now"}
              loading={syncing}
              onPress={() => {
                setSyncing(true);
                syncNow()
                  .catch((error) => Alert.alert("Sync failed", error instanceof Error ? error.message : "Unable to sync now"))
                  .finally(() => setSyncing(false));
              }}
            />
            <PrimaryButton
              title={loggingOut ? "Signing out..." : "Logout"}
              variant="danger"
              loading={loggingOut}
              onPress={() => {
                setLoggingOut(true);
                logout()
                  .catch((error) => Alert.alert("Logout failed", error instanceof Error ? error.message : "Unable to sign out"))
                  .finally(() => setLoggingOut(false));
              }}
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function formatRoleLabel(role?: string | null) {
  if (role === "owner") return "Owner";
  if (role === "manager") return "Manager";
  if (role === "cashier") return "Cashier";
  return "Cashier";
}
