import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "vbo.session";
const SESSION_METADATA_ACTIVE_KEY = "vbo.session.metadata.active";
const SESSION_METADATA_PREFIX = "vbo.session.metadata";
const DEVICE_KEY = "vbo.device";
const THEME_KEY = "vbo.themeMode";
const OFFLINE_QUEUE_KEY = "vbo.offlineQueue";
const BUSINESS_OPERATIONS_CACHE_KEY = "vbo.businessOperationsCache";
const POS_DRAFTS_KEY = "vbo.posDrafts";
const NOTIFICATIONS_KEY = "vbo.notifications";
const PUSH_REGISTRATION_KEY = "vbo.pushRegistration";

const STORAGE_ERROR_MESSAGE = "Secure storage is unavailable. Please try again. If the problem continues, restart the app or contact support.";

function storageError() {
  // Never pass through native error details: platform messages can include storage keys.
  return new Error(STORAGE_ERROR_MESSAGE);
}

async function readValue(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // Keep startup and login available when the native keystore cannot be read.
    // Do not delete anything: a later successful read may restore the saved session.
    return null;
  }
}

async function writeValue(key: string, value: string) {
  try {
    // Expo SecureStore v14 signature: setItemAsync(key, value, options?).
    // Omit options unless a supported SecureStoreOptions value is needed.
    await SecureStore.setItemAsync(key, value);
  } catch {
    throw storageError();
  }
}

async function deleteValue(key: string) {
  try {
    // Expo SecureStore v14 signature: deleteItemAsync(key, options?).
    await SecureStore.deleteItemAsync(key);
  } catch {
    throw storageError();
  }
}

function sessionMetadataKey(generation: string, field: string) {
  return `${SESSION_METADATA_PREFIX}.${generation}.${field}`;
}

async function getSessionMetadata() {
  const generation = await readValue(SESSION_METADATA_ACTIVE_KEY);
  if (!generation) return null;
  try {
    const [user, business, selectedBranchId, branchCountValue] = await Promise.all([
      readValue(sessionMetadataKey(generation, "user")),
      readValue(sessionMetadataKey(generation, "business")),
      readValue(sessionMetadataKey(generation, "selectedBranchId")),
      readValue(sessionMetadataKey(generation, "branchCount"))
    ]);
    if (!user || !business || !selectedBranchId || !branchCountValue) return null;
    const branchCount = Number(branchCountValue);
    if (!Number.isSafeInteger(branchCount) || branchCount < 0 || branchCount > 1000) return null;
    const branches = await Promise.all(
      Array.from({ length: branchCount }, (_, index) => readValue(sessionMetadataKey(generation, `branch.${index}`)))
    );
    if (branches.some((branch) => !branch)) return null;
    return JSON.stringify({
      version: 1,
      user: JSON.parse(user),
      business: JSON.parse(business),
      selectedBranchId: JSON.parse(selectedBranchId),
      branches: branches.map((branch) => JSON.parse(branch!))
    });
  } catch {
    return null;
  }
}

async function setSessionMetadata(value: string) {
  let parsed: { user?: unknown; business?: unknown; selectedBranchId?: unknown; branches?: unknown };
  try {
    parsed = JSON.parse(value);
    if (!parsed.user || !Array.isArray(parsed.branches)) throw new Error("Invalid session metadata");
  } catch {
    throw storageError();
  }

  const previousGeneration = await readValue(SESSION_METADATA_ACTIVE_KEY);
  const previousBranchCountValue = previousGeneration
    ? await readValue(sessionMetadataKey(previousGeneration, "branchCount"))
    : null;
  const generation = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const branches = parsed.branches as unknown[];
  const entries: Array<[string, string]> = [
    ["user", JSON.stringify(parsed.user)],
    ["business", JSON.stringify(parsed.business ?? null)],
    ["selectedBranchId", JSON.stringify(parsed.selectedBranchId ?? null)],
    ["branchCount", String(branches.length)],
    ...branches.map((branch, index): [string, string] => [`branch.${index}`, JSON.stringify(branch)])
  ];

  await Promise.all(entries.map(([field, entry]) => writeValue(sessionMetadataKey(generation, field), entry)));
  // Switch the active pointer only after every field is safely persisted.
  await writeValue(SESSION_METADATA_ACTIVE_KEY, generation);

  if (previousGeneration && previousGeneration !== generation) {
    const oldBranchCount = Number(previousBranchCountValue);
    const oldFields = ["user", "business", "selectedBranchId", "branchCount"];
    if (Number.isSafeInteger(oldBranchCount) && oldBranchCount >= 0 && oldBranchCount <= 1000) {
      oldFields.push(...Array.from({ length: oldBranchCount }, (_, index) => `branch.${index}`));
    }
    await Promise.all(oldFields.map((field) => deleteValue(sessionMetadataKey(previousGeneration, field)).catch(() => undefined)));
  }
}

async function clearSessionMetadata() {
  const generation = await readValue(SESSION_METADATA_ACTIVE_KEY);
  if (!generation) return;
  const branchCount = Number(await readValue(sessionMetadataKey(generation, "branchCount")));
  const fields = ["user", "business", "selectedBranchId", "branchCount"];
  if (Number.isSafeInteger(branchCount) && branchCount >= 0 && branchCount <= 1000) {
    fields.push(...Array.from({ length: branchCount }, (_, index) => `branch.${index}`));
  }
  await Promise.all([deleteValue(SESSION_METADATA_ACTIVE_KEY), ...fields.map((field) => deleteValue(sessionMetadataKey(generation, field)))]);
}

function compactSessionValue(value: string) {
  try {
    const parsed = JSON.parse(value) as { accessToken?: unknown };
    if (typeof parsed.accessToken === "string" && parsed.accessToken.trim()) {
      // Keep only the credential in SecureStore. Profile and workspace metadata
      // are persisted separately so large business settings cannot exceed the
      // platform's SecureStore value limit.
      return JSON.stringify({ accessToken: parsed.accessToken });
    }
  } catch {
    // Preserve invalid legacy values so the normal reader can reject them.
  }
  return value;
}

export const secureStore = {
  getSession: async () => readValue(SESSION_KEY),
  setSession: async (value: string) => writeValue(SESSION_KEY, compactSessionValue(value)),
  clearSession: async () => Promise.all([deleteValue(SESSION_KEY), clearSessionMetadata()]).then(() => undefined),
  getSessionMetadata,
  setSessionMetadata,
  clearSessionMetadata,
  getDeviceId: async () => readValue(DEVICE_KEY),
  setDeviceId: async (value: string) => writeValue(DEVICE_KEY, value),
  getThemeMode: async () => readValue(THEME_KEY),
  setThemeMode: async (value: string) => writeValue(THEME_KEY, value),
  getOfflineQueue: async () => readValue(OFFLINE_QUEUE_KEY),
  setOfflineQueue: async (value: string) => writeValue(OFFLINE_QUEUE_KEY, value),
  clearOfflineQueue: async () => deleteValue(OFFLINE_QUEUE_KEY),
  getBusinessOperationsCache: async () => readValue(BUSINESS_OPERATIONS_CACHE_KEY),
  setBusinessOperationsCache: async (value: string) => writeValue(BUSINESS_OPERATIONS_CACHE_KEY, value),
  getPosDrafts: async () => readValue(POS_DRAFTS_KEY),
  setPosDrafts: async (value: string) => writeValue(POS_DRAFTS_KEY, value),
  clearPosDrafts: async () => deleteValue(POS_DRAFTS_KEY),
  getNotifications: async () => readValue(NOTIFICATIONS_KEY),
  setNotifications: async (value: string) => writeValue(NOTIFICATIONS_KEY, value),
  clearNotifications: async () => deleteValue(NOTIFICATIONS_KEY),
  getPushRegistration: async () => readValue(PUSH_REGISTRATION_KEY),
  setPushRegistration: async (value: string) => writeValue(PUSH_REGISTRATION_KEY, value),
  clearPushRegistration: async () => deleteValue(PUSH_REGISTRATION_KEY)
};
