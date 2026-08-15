import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "vbo.session";
const DEVICE_KEY = "vbo.device";
const THEME_KEY = "vbo.themeMode";
const OFFLINE_QUEUE_KEY = "vbo.offlineQueue";
const POS_DRAFTS_KEY = "vbo.posDrafts";

export const secureStore = {
  getSession: async () => SecureStore.getItemAsync(SESSION_KEY),
  setSession: async (value: string) => SecureStore.setItemAsync(SESSION_KEY, value),
  clearSession: async () => SecureStore.deleteItemAsync(SESSION_KEY),
  getDeviceId: async () => SecureStore.getItemAsync(DEVICE_KEY),
  setDeviceId: async (value: string) => SecureStore.setItemAsync(DEVICE_KEY, value),
  getThemeMode: async () => SecureStore.getItemAsync(THEME_KEY),
  setThemeMode: async (value: string) => SecureStore.setItemAsync(THEME_KEY, value),
  getOfflineQueue: async () => SecureStore.getItemAsync(OFFLINE_QUEUE_KEY),
  setOfflineQueue: async (value: string) => SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, value),
  clearOfflineQueue: async () => SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY),
  getPosDrafts: async () => SecureStore.getItemAsync(POS_DRAFTS_KEY),
  setPosDrafts: async (value: string) => SecureStore.setItemAsync(POS_DRAFTS_KEY, value),
  clearPosDrafts: async () => SecureStore.deleteItemAsync(POS_DRAFTS_KEY)
};
