import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AppScrollView, Badge, EmptyState, ErrorState, GradientHeader, LoadingState, Pagination, PrimaryButton, Screen } from "@/components/Primitives";
import { SearchField } from "@/components/DesignSystem";
import { markAllNotificationsRead, listNotificationsPage, markNotificationRead } from "@/services/apiClient";
import type { AppInboxNotification } from "@/services/notifications";
import { tokens } from "@/theme/tokens";

export function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = React.useState<AppInboxNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const deferredSearch = React.useDeferredValue(search);

  async function loadInbox(nextPage = page, mode: "initial" | "refresh" = "initial") {
    setError(null);
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    try {
      const response = await listNotificationsPage({ page: nextPage, pageSize: 12, search: deferredSearch });
      setNotifications(response.items.map((notification) => ({ ...notification, source: "remote" as const })));
      setPage(response.page);
      setTotalPages(response.totalPages);
      setUnreadCount(response.unreadCount);
    } catch (cause) {
      setError("We could not load notifications. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  React.useEffect(() => {
    setPage(1);
    void loadInbox(1);
  }, [deferredSearch]);

  async function openNotification(notification: AppInboxNotification) {
    try {
      await markNotificationRead(notification.id);
      setNotifications((current) => current.map((entry) => (entry.id === notification.id ? { ...entry, readAt: new Date().toISOString() } : entry)));
      setUnreadCount((count) => Math.max(0, count - (notification.readAt ? 0 : 1)));
    } catch (cause) {
      Alert.alert("Could not update notification", "Try again shortly.");
      return;
    }
    if (notification.routeName) navigation.navigate(notification.routeName, notification.routeParams ?? undefined);
  }

  async function markAllAsRead() {
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((entry) => ({ ...entry, readAt: entry.readAt ?? readAt })));
      setUnreadCount(0);
    } catch (cause) {
      Alert.alert("Could not mark all as read", "Try again shortly.");
    }
  }

  return (
    <Screen>
      <GradientHeader
        title="Notifications"
        subtitle={unreadCount ? `${unreadCount} unread business update${unreadCount === 1 ? "" : "s"}` : "You are all caught up"}
        right={
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close notifications">
            <Ionicons name="close-outline" size={28} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <AppScrollView refreshing={refreshing} onRefresh={() => void loadInbox(page, "refresh")} contentContainerStyle={{ gap: 0, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28 }}>
        <View style={{ gap: 9, paddingBottom: 12, borderBottomWidth: 1, borderColor: tokens.colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "800" }}>Business inbox</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>Workspace updates and alerts</Text>
            </View>
            <Badge label={`${unreadCount} unread`} tone={unreadCount ? "warning" : "success"} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}><SearchField value={search} onChangeText={setSearch} placeholder="Search notifications" accessibilityLabel="Search notifications" /></View>
            {unreadCount ? <PrimaryButton title="Mark all read" variant="secondary" onPress={() => void markAllAsRead()} /> : null}
          </View>
        </View>

        {loading ? (
          <LoadingState label="Loading notifications" />
        ) : error ? (
          <ErrorState title="Notifications unavailable" subtitle={error} action={<PrimaryButton title="Try again" onPress={() => void loadInbox(page)} />} />
        ) : notifications.length ? (
          <View style={{ borderTopWidth: 1, borderColor: tokens.colors.border }}>
            {notifications.map((notification) => {
              const isUnread = !notification.readAt;
              return (
                <Pressable key={notification.id} onPress={() => void openNotification(notification)} accessibilityRole="button" accessibilityLabel={`${isUnread ? "Unread notification" : "Notification"}: ${notification.title}`} style={{ paddingVertical: 11, borderBottomWidth: 1, borderColor: tokens.colors.border, backgroundColor: isUnread ? tokens.colors.surfaceAlt : "transparent" }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
                      <View style={{ width: 7, height: 7, marginTop: 6, borderRadius: 4, backgroundColor: isUnread ? tokens.colors.primaryStrong : "transparent" }} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ flex: 1, color: tokens.colors.text, fontSize: 13, fontWeight: isUnread ? "800" : "700" }} numberOfLines={1}>{notification.title}</Text>
                          <Badge label={notification.priority} tone={notification.priority === "critical" ? "danger" : isUnread ? "warning" : "primary"} />
                        </View>
                        <Text style={{ color: tokens.colors.textSecondary, fontSize: 11, lineHeight: 16 }} numberOfLines={2}>{notification.body}</Text>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                          <Text style={{ color: tokens.colors.textMuted, fontSize: 10 }}>{formatNotificationTime(notification.sentAt)}</Text>
                          {notification.routeName ? <Text style={{ color: tokens.colors.primaryStrong, fontSize: 11, fontWeight: "800" }}>Open details</Text> : null}
                        </View>
                      </View>
                    </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState title={search ? "No matching notifications" : "Nothing new"} subtitle={search ? "Try a shorter search." : "New business events and system updates will appear here."} icon="notifications-off-outline" />
        )}
        {!loading && !error ? <Pagination currentPage={page} totalPages={totalPages} onPageChange={(nextPage) => void loadInbox(nextPage)} loading={loading} compact /> : null}
      </AppScrollView>
    </Screen>
  );
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Just now" : date.toLocaleString();
}
