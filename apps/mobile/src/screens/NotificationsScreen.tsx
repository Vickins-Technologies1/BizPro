import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AppScrollView, Badge, Card, EmptyState, ErrorState, GradientHeader, InputField, LoadingState, Pagination, PrimaryButton, Screen } from "@/components/Primitives";
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
      <AppScrollView refreshing={refreshing} onRefresh={() => void loadInbox(page, "refresh")} contentContainerStyle={{ gap: 12, paddingBottom: 28 }}>
        <Card style={{ gap: 10, padding: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: tokens.colors.primary + "18" }}>
              <Ionicons name="notifications-outline" size={22} color={tokens.colors.primaryStrong} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "900" }}>Business inbox</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>Workspace updates and alerts.</Text>
            </View>
            <Badge label={`${unreadCount} unread`} tone={unreadCount ? "warning" : "success"} />
          </View>
          <InputField label="Search" value={search} onChangeText={setSearch} placeholder="Search notifications" />
          {unreadCount ? <PrimaryButton title="Mark all as read" variant="secondary" onPress={() => void markAllAsRead()} /> : null}
        </Card>

        {loading ? (
          <LoadingState label="Loading notifications" />
        ) : error ? (
          <ErrorState title="Notifications unavailable" subtitle={error} action={<PrimaryButton title="Try again" onPress={() => void loadInbox(page)} />} />
        ) : notifications.length ? (
          <View style={{ gap: 10 }}>
            {notifications.map((notification) => {
              const isUnread = !notification.readAt;
              return (
                <Pressable key={notification.id} onPress={() => void openNotification(notification)}>
                  <Card style={{ gap: 6, padding: 11, borderColor: isUnread ? tokens.colors.primaryStrong : tokens.colors.border, backgroundColor: isUnread ? tokens.colors.surfaceAlt : tokens.colors.surface }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: isUnread ? tokens.colors.primary + "18" : tokens.colors.surfaceAlt }}>
                        <Ionicons name={isUnread ? "mail-unread-outline" : "mail-open-outline"} size={17} color={isUnread ? tokens.colors.primaryStrong : tokens.colors.textMuted} />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "900" }} numberOfLines={1}>{notification.title}</Text>
                        <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>{notification.body}</Text>
                      </View>
                      <Badge label={notification.priority} tone={notification.priority === "critical" ? "danger" : isUnread ? "warning" : "primary"} />
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>{formatNotificationTime(notification.sentAt)}</Text>
                      {notification.routeName ? <Text style={{ color: tokens.colors.primaryStrong, fontSize: 12, fontWeight: "800" }}>Open details</Text> : null}
                    </View>
                  </Card>
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
