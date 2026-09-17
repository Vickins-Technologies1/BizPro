declare module "expo-camera" {
  import * as React from "react";

  export type BarcodeType =
    | "aztec"
    | "codabar"
    | "code128"
    | "code39"
    | "code93"
    | "datamatrix"
    | "ean13"
    | "ean8"
    | "itf14"
    | "pdf417"
    | "qr"
    | "upc_a"
    | "upc_e"
    | string;

  export type BarcodeScanningResult = {
    data?: string | null;
    type?: BarcodeType;
    bounds?: unknown;
    cornerPoints?: Array<{ x: number; y: number }>;
    target?: number;
  };

  export type CameraPermissionResponse = {
    granted: boolean;
    canAskAgain: boolean;
    expires?: string;
    status?: "granted" | "denied" | "undetermined";
  };

  export function useCameraPermissions(): [
    CameraPermissionResponse | null,
    () => Promise<CameraPermissionResponse>
  ];

  export const CameraView: React.ComponentType<{
    style?: unknown;
    facing?: "front" | "back";
    animateShutter?: boolean;
    onCameraReady?: () => void;
    onMountError?: (error: { message?: string }) => void;
    onBarcodeScanned?: ((result: BarcodeScanningResult) => void) | undefined;
    barcodeScannerSettings?: {
      barcodeTypes?: BarcodeType[];
    };
  }> & {
    isAvailableAsync(): Promise<boolean>;
  };
}

declare module "expo-device" {
  export const isDevice: boolean;
  export const deviceName: string | null;
  export const modelName: string | null;
  export const brand: string | null;
  export const manufacturer: string | null;
  export const osName: string | null;
  export const osVersion: string | null;
  export const osBuildId: string | null;
  export const designName: string | null;
  export const productName: string | null;
  export const totalMemory: number | null;
  export const supportedCpuArchitectures: string[] | null;
  export const platformApiLevel: number | null;
  export const deviceType: number | null;
}

declare module "expo-notifications" {
  export type NotificationPermissionsStatus = "granted" | "denied" | "undetermined";

  export type NotificationPermissionsResponse = {
    status: NotificationPermissionsStatus;
    canAskAgain?: boolean;
    expires?: string;
  };

  export type NotificationContent = {
    title?: string | null;
    body?: string | null;
    data?: Record<string, unknown>;
  };

  export type NotificationRequest = {
    content: NotificationContent;
  };

  export type Notification = {
    request: NotificationRequest;
  };

  export type NotificationResponse = {
    notification: Notification;
  };

  export type ExpoPushTokenResponse = {
    data: string;
  };

  export type PushToken = ExpoPushTokenResponse;

  export type NotificationChannelInput = {
    name: string;
    importance?: number;
    vibrationPattern?: number[];
    lightColor?: string;
  };

  export type NotificationBehavior = {
    shouldShowAlert?: boolean;
    shouldPlaySound?: boolean;
    shouldSetBadge?: boolean;
    shouldShowBanner?: boolean;
    shouldShowList?: boolean;
  };

  export const AndroidImportance: {
    DEFAULT: number;
    HIGH: number;
    LOW: number;
    MIN: number;
    NONE: number;
  };

  export function setNotificationHandler(handler: {
    handleNotification: () => Promise<NotificationBehavior> | NotificationBehavior;
  }): void;

  export function getPermissionsAsync(): Promise<NotificationPermissionsResponse>;
  export function requestPermissionsAsync(): Promise<NotificationPermissionsResponse>;
  export function setNotificationChannelAsync(id: string, channel: NotificationChannelInput): Promise<void>;
  export function getExpoPushTokenAsync(options?: { projectId?: string }): Promise<ExpoPushTokenResponse>;
  export function addPushTokenListener(listener: (token: PushToken) => void): { remove: () => void };

  export function addNotificationReceivedListener(
    listener: (notification: Notification) => void
  ): { remove: () => void };

  export function addNotificationResponseReceivedListener(
    listener: (response: NotificationResponse) => void
  ): { remove: () => void };

  export function getLastNotificationResponseAsync(): Promise<NotificationResponse | null>;
}
