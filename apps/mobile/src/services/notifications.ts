import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { createId } from "@/utils/id";
import { secureStore } from "@/storage/secure";
import {
  listNotifications as apiListNotifications,
  markNotificationRead as apiMarkNotificationRead,
  registerDevicePushToken as apiRegisterDevicePushToken,
  type NotificationRecord
} from "@/services/apiClient";
import { navigateFromNotification } from "@/navigation/navigationRef";

type NotificationSource = "remote" | "local";

export type AppInboxNotification = NotificationRecord & {
  source: NotificationSource;
};

type NotificationCache = {
  version: 1;
  entries: AppInboxNotification[];
};

type RegisterPushInput = {
  businessId: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  platform: "android" | "ios" | "web";
  requestPermission?: boolean;
};

type StoredPushRegistration = {
  businessId: string;
  userId: string;
  deviceId: string;
  pushToken: string;
};

const DEFAULT_CACHE: NotificationCache = { version: 1, entries: [] };
let listenersInstalled = false;
let registrationInFlight: Promise<PushRegistrationResult> | null = null;
let activeRegistration: RegisterPushInput | null = null;

type PushRegistrationResult =
  | { status: "registered"; token: string }
  | { status: "unavailable" | "not-requested" | "denied" | "error"; message: string };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

function parseCache(raw: string | null): NotificationCache {
  if (!raw) return DEFAULT_CACHE;
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationCache>;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return DEFAULT_CACHE;
    }
    return { version: 1, entries: parsed.entries.filter(Boolean) as AppInboxNotification[] };
  } catch {
    return DEFAULT_CACHE;
  }
}

async function readCache() {
  return parseCache(await secureStore.getNotifications());
}

async function writeCache(cache: NotificationCache) {
  await secureStore.setNotifications(JSON.stringify(cache));
}

function mergeNotifications(entries: AppInboxNotification[]) {
  return [...entries].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function normalizeNotification(input: Partial<AppInboxNotification> & Pick<AppInboxNotification, "id" | "title" | "body" | "category" | "priority" | "sentAt" | "createdAt" | "updatedAt">): AppInboxNotification {
  return {
    ...input,
    businessId: input.businessId ?? "",
    audienceUserId: input.audienceUserId ?? null,
    routeName: input.routeName ?? null,
    routeParams: input.routeParams ?? null,
    metadata: input.metadata ?? null,
    readAt: input.readAt ?? null,
    source: input.source ?? "local"
  };
}

export async function getStoredNotifications() {
  const cache = await readCache();
  return mergeNotifications(cache.entries);
}

export async function upsertStoredNotification(notification: AppInboxNotification) {
  const cache = await readCache();
  const next = cache.entries.filter((entry) => entry.id !== notification.id);
  next.unshift(notification);
  await writeCache({ version: 1, entries: mergeNotifications(next) });
  return notification;
}

export async function markStoredNotificationRead(id: string) {
  const cache = await readCache();
  const next = cache.entries.map((entry) => (entry.id === id ? { ...entry, readAt: new Date().toISOString() } : entry));
  await writeCache({ version: 1, entries: next });
}

export async function clearStoredNotifications() {
  await secureStore.clearNotifications();
}

export async function loadNotificationInbox() {
  const [remote, local] = await Promise.all([apiListNotifications().catch(() => []), getStoredNotifications()]);
  const merged = new Map<string, AppInboxNotification>();
  for (const notification of local) {
    merged.set(notification.id, notification);
  }
  for (const notification of remote) {
    merged.set(
      notification.id,
      normalizeNotification({
        ...notification,
        source: "remote"
      })
    );
  }
  const entries = mergeNotifications(Array.from(merged.values()));
  await writeCache({ version: 1, entries });
  return entries;
}

export async function markNotificationRead(id: string) {
  const current = (await getStoredNotifications()).find((notification) => notification.id === id);
  if (current) {
    await markStoredNotificationRead(id);
  }
  return apiMarkNotificationRead(id).catch(() => current ?? null);
}

export async function recordLocalNotification(input: {
  businessId?: string;
  title: string;
  body: string;
  category?: string;
  priority?: AppInboxNotification["priority"];
  routeName?: string | null;
  routeParams?: Record<string, unknown> | null;
  audienceUserId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const now = new Date().toISOString();
  const notification = normalizeNotification({
    id: createId(),
    businessId: input.businessId ?? "",
    title: input.title,
    body: input.body,
    category: input.category ?? "general",
    priority: input.priority ?? "normal",
    routeName: input.routeName ?? null,
    routeParams: input.routeParams ?? null,
    metadata: input.metadata ?? null,
    audienceUserId: input.audienceUserId ?? null,
    sentAt: now,
    readAt: null,
    createdAt: now,
    updatedAt: now,
    source: "local"
  });
  await upsertStoredNotification(notification);
  return notification;
}

export async function registerPushNotifications(input: RegisterPushInput) {
  if (registrationInFlight) {
    return registrationInFlight;
  }

  registrationInFlight = registerPushNotificationsInternal(input);
  try {
    return await registrationInFlight;
  } catch (error) {
    console.warn("[notifications] Notification setup failed", error);
    return { status: "error", message: "Notifications could not be enabled on this device. Please try again." };
  } finally {
    registrationInFlight = null;
  }
}

async function registerPushNotificationsInternal(input: RegisterPushInput): Promise<PushRegistrationResult> {
  if (Platform.OS === "web") {
    return { status: "unavailable" as const, message: "Push notifications are not available on web." };
  }

  if (!Device.isDevice) {
    return { status: "unavailable" as const, message: "Push notifications require a physical device." };
  }

  const permission = await Notifications.getPermissionsAsync();
  let finalPermission = permission;
  if (permission.status !== "granted" && input.requestPermission) {
    finalPermission = await Notifications.requestPermissionsAsync();
  }
  if (finalPermission.status !== "granted" && !input.requestPermission) {
    return { status: "not-requested" as const, message: "Notification permission has not been requested." };
  }
  if (finalPermission.status !== "granted") {
    return { status: "denied" as const, message: "Notifications are disabled. You can enable them in Settings." };
  }

  activeRegistration = input;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("biz-pro", {
      name: "Biz Pro",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563EB"
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
  if (!projectId) {
    return { status: "error", message: "Push notifications are not configured for this app build." };
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const previousRaw = await secureStore.getPushRegistration();
    let previous: StoredPushRegistration | null = null;
    try {
      previous = previousRaw ? (JSON.parse(previousRaw) as StoredPushRegistration) : null;
    } catch {
      previous = null;
    }

    const unchanged = previous?.businessId === input.businessId && previous.userId === input.userId && previous.deviceId === input.deviceId && previous.pushToken === token;
    if (!unchanged) {
      await apiRegisterDevicePushToken({ ...input, pushToken: token });
      await secureStore.setPushRegistration(JSON.stringify({
        businessId: input.businessId,
        userId: input.userId,
        deviceId: input.deviceId,
        pushToken: token
      } satisfies StoredPushRegistration));
    }
    return { status: "registered", token };
  } catch (error) {
    console.warn("[notifications] Push registration failed", error);
    return { status: "error", message: "Notifications could not be enabled on this device. Check your connection and try again." };
  }
}

export function configureNotificationListeners() {
  if (listenersInstalled) {
    return () => undefined;
  }
  listenersInstalled = true;

  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    const content = notification.request.content;
    const data = (content.data ?? {}) as Record<string, unknown>;
    void upsertStoredNotification(
      normalizeNotification({
        id: String(data.notificationId ?? createId()),
        businessId: String(data.businessId ?? ""),
        audienceUserId: data.audienceUserId ? String(data.audienceUserId) : null,
        title: content.title ?? "Biz Pro alert",
        body: content.body ?? "",
        category: String(data.category ?? "general"),
        priority: (data.priority as AppInboxNotification["priority"]) ?? "normal",
        routeName: data.routeName ? String(data.routeName) : null,
        routeParams: (data.routeParams as Record<string, unknown> | undefined) ?? null,
        metadata: (data.metadata as Record<string, unknown> | undefined) ?? null,
        sentAt: String(data.sentAt ?? new Date().toISOString()),
        readAt: null,
        createdAt: String(data.createdAt ?? new Date().toISOString()),
        updatedAt: new Date().toISOString(),
        source: "remote"
      })
    );
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
    const notificationId = data.notificationId ? String(data.notificationId) : null;
    if (notificationId) {
      void markNotificationRead(notificationId).catch(() => undefined);
    }
    if (data.routeName) {
      navigateFromNotification(String(data.routeName), (data.routeParams as Record<string, unknown> | undefined) ?? null);
    }
  });

  const pushTokenSubscription = Notifications.addPushTokenListener((token) => {
    const registration = activeRegistration;
    if (!registration || !token.data) return;
    void apiRegisterDevicePushToken({ ...registration, pushToken: token.data })
      .then(() => secureStore.setPushRegistration(JSON.stringify({
        businessId: registration.businessId,
        userId: registration.userId,
        deviceId: registration.deviceId,
        pushToken: token.data
      } satisfies StoredPushRegistration)))
      .catch((error) => console.warn("[notifications] Push token refresh registration failed", error));
  });

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
    if (data.notificationId) {
      void markNotificationRead(String(data.notificationId)).catch(() => undefined);
    }
    if (data.routeName) {
      navigateFromNotification(String(data.routeName), (data.routeParams as Record<string, unknown> | undefined) ?? null);
    }
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
    pushTokenSubscription.remove();
    listenersInstalled = false;
  };
}
