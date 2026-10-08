import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AppScrollView, Card, Screen } from "@/components/Primitives";
import { useAppStore } from "@/store/useAppStore";
import { useThemeTokens } from "@/theme";

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const theme = useThemeTokens();
  const user = useAppStore((state) => state.user);
  const business = useAppStore((state) => state.business);
  const logout = useAppStore((state) => state.logout);
  const [loggingOut, setLoggingOut] = React.useState(false);

  if (!user) return null;

  const initials = user.fullName.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  const role = user.roleLabel ?? user.role;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      Alert.alert("Logout failed", error instanceof Error ? error.message : "Unable to sign out");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Screen>
      <AppScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, opacity: pressed ? 0.78 : 1 })}
          >
            <Ionicons name="arrow-back" size={19} color={theme.colors.text} />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>Account</Text>
            <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "800" }}>Profile</Text>
          </View>
        </View>

        <Card style={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
            <View style={{ width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: `${theme.colors.primary}18`, borderWidth: 1, borderColor: `${theme.colors.primaryStrong}40` }}>
              <Text style={{ color: theme.colors.primaryStrong, fontSize: 20, fontWeight: "900" }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "800" }} numberOfLines={1}>{user.fullName}</Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{role}</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>{business?.name ?? "Dira OS workspace"}</Text>
            </View>
            <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: theme.colors.success }} accessibilityLabel="Authenticated session active" />
          </View>
        </Card>

        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>Account information</Text>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <InfoRow label="Full name" value={user.fullName} />
            <InfoRow label="Role" value={role} />
            <InfoRow label="Business" value={business?.name} />
            {business?.billingStatus ? <InfoRow label="Business status" value={business.billingStatus.replace("_", " ")} /> : null}
          </Card>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>Actions</Text>
          <Card style={{ padding: 14, gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Ionicons name="information-circle-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={{ flex: 1, color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>Profile editing and password changes are not currently available in the authenticated account API.</Text>
            </View>
            <Pressable
              onPress={handleLogout}
              disabled={loggingOut}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              style={({ pressed }) => ({ minHeight: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: `${theme.colors.danger}14`, borderWidth: 1, borderColor: `${theme.colors.danger}45`, opacity: loggingOut ? 0.55 : pressed ? 0.78 : 1 })}
            >
              <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
              <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: "800" }}>{loggingOut ? "Signing out…" : "Log out"}</Text>
            </Pressable>
          </Card>
        </View>
      </AppScrollView>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null | undefined }) {
  const theme = useThemeTokens();
  if (!value) return null;
  return (
    <View style={{ minHeight: 48, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "700", flexShrink: 1, textAlign: "right" }} numberOfLines={2}>{value}</Text>
    </View>
  );
}
