import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

let pendingRoute: { routeName: string; params?: Record<string, unknown> | null } | null = null;

export function navigateFromNotification(routeName?: string | null, params?: Record<string, unknown> | null) {
  if (!routeName || !navigationRef.isReady()) {
    if (routeName) {
      pendingRoute = { routeName, params: params ?? null };
    }
    return false;
  }
  navigationRef.navigate(routeName as any, params as any);
  return true;
}

export function flushPendingNotificationNavigation() {
  if (!pendingRoute || !navigationRef.isReady()) {
    return false;
  }
  const { routeName, params } = pendingRoute;
  pendingRoute = null;
  navigationRef.navigate(routeName as any, params as any);
  return true;
}
