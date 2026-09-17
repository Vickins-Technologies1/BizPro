import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "vbo.session";
const DEVICE_KEY = "vbo.device";
const THEME_KEY = "vbo.themeMode";
const OFFLINE_QUEUE_KEY = "vbo.offlineQueue";
const POS_DRAFTS_KEY = "vbo.posDrafts";
const NOTIFICATIONS_KEY = "vbo.notifications";
const PUSH_REGISTRATION_KEY = "vbo.pushRegistration";

async function readValue(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // A broken or unavailable keystore must not prevent the app from showing login.
    return null;
  }
}

export const secureStore = {
  getSession: async () => readValue(SESSION_KEY),
  setSession: async (value: string) => SecureStore.setItemAsync(SESSION_KEY, value),
  clearSession: async () => SecureStore.deleteItemAsync(SESSION_KEY),
  getDeviceId: async () => readValue(DEVICE_KEY),
  setDeviceId: async (value: string) => SecureStore.setItemAsync(DEVICE_KEY, value),
  getThemeMode: async () => readValue(THEME_KEY),
  setThemeMode: async (value: string) => SecureStore.setItemAsync(THEME_KEY, value),
  getOfflineQueue: async () => readValue(OFFLINE_QUEUE_KEY),
  setOfflineQueue: async (value: string) => SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, value),
  clearOfflineQueue: async () => SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY),
  getPosDrafts: async () => readValue(POS_DRAFTS_KEY),
  setPosDrafts: async (value: string) => SecureStore.setItemAsync(POS_DRAFTS_KEY, value),
  clearPosDrafts: async () => SecureStore.deleteItemAsync(POS_DRAFTS_KEY),
  getNotifications: async () => readValue(NOTIFICATIONS_KEY),
  setNotifications: async (value: string) => SecureStore.setItemAsync(NOTIFICATIONS_KEY, value),
  clearNotifications: async () => SecureStore.deleteItemAsync(NOTIFICATIONS_KEY),
  getPushRegistration: async () => readValue(PUSH_REGISTRATION_KEY),
  setPushRegistration: async (value: string) => SecureStore.setItemAsync(PUSH_REGISTRATION_KEY, value),
  clearPushRegistration: async () => SecureStore.deleteItemAsync(PUSH_REGISTRATION_KEY)
};
