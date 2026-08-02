import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "vbo.session";
const DEVICE_KEY = "vbo.device";
const THEME_KEY = "vbo.themeMode";

export const secureStore = {
  getSession: async () => SecureStore.getItemAsync(SESSION_KEY),
  setSession: async (value: string) => SecureStore.setItemAsync(SESSION_KEY, value),
  clearSession: async () => SecureStore.deleteItemAsync(SESSION_KEY),
  getDeviceId: async () => SecureStore.getItemAsync(DEVICE_KEY),
  setDeviceId: async (value: string) => SecureStore.setItemAsync(DEVICE_KEY, value),
  getThemeMode: async () => SecureStore.getItemAsync(THEME_KEY),
  setThemeMode: async (value: string) => SecureStore.setItemAsync(THEME_KEY, value)
};
