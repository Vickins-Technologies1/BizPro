import React from "react";
import { ActivityIndicator, Alert, AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, type BarcodeScanningResult, type BarcodeType, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useThemeTokens } from "@/theme";
import { PrimaryButton } from "@/components/Primitives";

type BarcodeScannerModalContentProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onBarcodeScanned: (barcode: string, raw?: BarcodeScanningResult) => void | Promise<void>;
};

const SUPPORTED_BARCODE_TYPES = [
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code128",
  "code39",
  "code93",
  "itf14",
  "pdf417",
  "aztec",
  "datamatrix",
  "qr"
] as const satisfies readonly BarcodeType[];

export function BarcodeScannerModalContent({ visible, title = "Scan barcode", subtitle = "Point the camera at a product barcode", onClose, onBarcodeScanned }: BarcodeScannerModalContentProps) {
  const theme = useThemeTokens();
  const styles = createStyles(theme);
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionRequested, setPermissionRequested] = React.useState(false);
  const [scannerReady, setScannerReady] = React.useState(false);
  const [cameraSessionKey, setCameraSessionKey] = React.useState(0);
  const [scanStatus, setScanStatus] = React.useState<string>("Align the barcode inside the frame.");
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const lastScanRef = React.useRef<{ value: string; at: number } | null>(null);
  const busyRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!visible) {
      setPermissionRequested(false);
      setScannerReady(false);
      setScanStatus("Align the barcode inside the frame.");
      setCameraError(null);
      lastScanRef.current = null;
      busyRef.current = false;
      setCameraSessionKey((current) => current + 1);
    }
  }, [visible]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (!visible || !mountedRef.current) return;
      if (state !== "active") {
        setScannerReady(false);
        busyRef.current = false;
        return;
      }
      setCameraError(null);
      setScannerReady(false);
      setCameraSessionKey((current) => current + 1);
    });
    return () => subscription.remove();
  }, [visible]);

  React.useEffect(() => {
    if (!visible || permissionRequested || permission?.granted) {
      return;
    }
    setPermissionRequested(true);
    requestPermission().catch((error: unknown) => {
      if (!mountedRef.current) return;
      console.warn("[scanner] Camera permission request failed", error);
      setCameraError("Camera access is required to scan barcodes. Enable permission and try again.");
      setScanStatus("Camera access is required to scan barcodes.");
    });
  }, [permission?.granted, permissionRequested, requestPermission, visible]);

  const permissionDenied = permission?.granted === false && permission?.canAskAgain === false;
  const readyToScan = visible && permission?.granted === true && !cameraError;

  function handleBarcode(result: BarcodeScanningResult) {
    const value = String(result.data ?? "").trim();
    if (!value || busyRef.current) {
      return;
    }
    const now = Date.now();
    const last = lastScanRef.current;
    if (last && last.value === value && now - last.at < 1400) {
      return;
    }
    lastScanRef.current = { value, at: now };
    busyRef.current = true;
    if (mountedRef.current) setScanStatus(`Read ${value}`);
    Promise.resolve(onBarcodeScanned(value, result))
      .then(() => {
        if (mountedRef.current) onClose();
      })
      .catch((error) => {
        console.warn("[scanner] Scanned barcode handling failed", error);
        if (mountedRef.current) {
          setScanStatus("Could not use the scanned barcode. Try scanning it again.");
          busyRef.current = false;
        }
      })
      .finally(() => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          busyRef.current = false;
        }, 1200);
      });
  }

  function handleMountError(error: { message?: string }) {
    console.warn("[scanner] Camera mount failed", error);
    setScannerReady(false);
    setCameraError("The camera could not be started on this device. Check camera permission and try again.");
    setScanStatus("The camera could not be started.");
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close scanner">
            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        {readyToScan ? (
          <View style={styles.cameraShell}>
            <CameraView
              key={cameraSessionKey}
              style={StyleSheet.absoluteFill}
              facing="back"
              animateShutter
              onCameraReady={() => setScannerReady(true)}
              onMountError={handleMountError}
              onBarcodeScanned={scannerReady ? handleBarcode : undefined}
              barcodeScannerSettings={{ barcodeTypes: [...SUPPORTED_BARCODE_TYPES] }}
            />
            <View style={styles.frameOverlay} pointerEvents="none">
              <View style={styles.frameCornerTopLeft} />
              <View style={styles.frameCornerTopRight} />
              <View style={styles.frameCornerBottomLeft} />
              <View style={styles.frameCornerBottomRight} />
            </View>
            <View style={styles.cameraFooter}>
              <Text style={styles.cameraHint}>{scanStatus}</Text>
              <Text style={styles.cameraHintSecondary}>Keep the code centered and steady for a moment.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.permissionCard}>
            {permission?.granted && !cameraError && !scannerReady ? <ActivityIndicator size="large" color={theme.colors.primaryStrong} /> : <Ionicons name="camera-outline" size={34} color={theme.colors.primaryStrong} />}
            <Text style={styles.permissionTitle}>
              {cameraError ? "Camera unavailable" : permissionDenied ? "Camera permission disabled" : permission?.granted ? "Starting camera" : "Requesting camera access"}
            </Text>
            <Text style={styles.permissionText}>
              {cameraError
                ? cameraError
                : "Camera access is required to scan barcodes. Enable camera permission in Settings if it was denied."}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title={cameraError ? "Try again" : permissionDenied ? "Open settings" : permission?.granted ? "Retry" : "Allow camera"}
                  onPress={async () => {
                    if (cameraError) {
                      setCameraError(null);
                      setPermissionRequested(false);
                      setScannerReady(false);
                      setCameraSessionKey((current) => current + 1);
                      setScanStatus("Align the barcode inside the frame.");
                      return;
                    }
                    if (permissionDenied) {
                      await Linking.openSettings().catch(() => Alert.alert("Open settings", "Please enable camera access in your device settings."));
                      return;
                    }
                    setPermissionRequested(true);
                    await requestPermission().catch((error: unknown) => {
                      if (!mountedRef.current) return;
                      console.warn("[scanner] Camera permission retry failed", error);
                      setCameraError("Camera access is required to scan barcodes. Enable permission and try again.");
                    });
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Cancel" variant="secondary" onPress={onClose} />
              </View>
            </View>
          </View>
        )}

        {readyToScan ? (
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  onClose();
                }}
              />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    padding: 16,
    justifyContent: "center"
  },
  card: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 16,
    gap: 14,
    ...theme.shadow.modal
  },
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  subtitle: {
    color: theme.colors.textSecondary,
    lineHeight: 18,
    fontSize: 12
  },
  cameraShell: {
    minHeight: 420,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  frameCornerTopLeft: {
    position: "absolute",
    top: 28,
    left: 28,
    width: 64,
    height: 64,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: theme.colors.primaryStrong,
    borderTopLeftRadius: 20
  },
  frameCornerTopRight: {
    position: "absolute",
    top: 28,
    right: 28,
    width: 64,
    height: 64,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: theme.colors.primaryStrong,
    borderTopRightRadius: 20
  },
  frameCornerBottomLeft: {
    position: "absolute",
    bottom: 100,
    left: 28,
    width: 64,
    height: 64,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: theme.colors.primaryStrong,
    borderBottomLeftRadius: 20
  },
  frameCornerBottomRight: {
    position: "absolute",
    bottom: 100,
    right: 28,
    width: 64,
    height: 64,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: theme.colors.primaryStrong,
    borderBottomRightRadius: 20
  },
  cameraFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: theme.colors.overlay,
    gap: 4
  },
  cameraHint: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800"
  },
  cameraHintSecondary: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18
  },
  permissionCard: {
    gap: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  permissionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center"
  },
  permissionText: {
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20
  },
  actions: {
    flexDirection: "row",
    gap: 10
  }
  });
}
