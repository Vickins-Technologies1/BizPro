import React from "react";
import { Alert, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, type BarcodeScanningResult, type BarcodeType, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { tokens } from "@/theme/tokens";
import { PrimaryButton } from "@/components/Primitives";

type BarcodeScannerModalProps = {
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

export function BarcodeScannerModal({ visible, title = "Scan barcode", subtitle = "Point the camera at a product barcode", onClose, onBarcodeScanned }: BarcodeScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionRequested, setPermissionRequested] = React.useState(false);
  const [scannerReady, setScannerReady] = React.useState(false);
  const [scanStatus, setScanStatus] = React.useState<string>("Align the barcode inside the frame.");
  const lastScanRef = React.useRef<{ value: string; at: number } | null>(null);
  const busyRef = React.useRef(false);

  React.useEffect(() => {
    if (!visible) {
      setPermissionRequested(false);
      setScannerReady(false);
      setScanStatus("Align the barcode inside the frame.");
      lastScanRef.current = null;
      busyRef.current = false;
    }
  }, [visible]);

  React.useEffect(() => {
    if (!visible || permissionRequested || permission?.granted) {
      return;
    }
    setPermissionRequested(true);
    requestPermission().catch(() => {
      setScanStatus("Camera access is required to scan barcodes.");
    });
  }, [permission?.granted, permissionRequested, requestPermission, visible]);

  const permissionDenied = permission?.granted === false && permission?.canAskAgain === false;
  const readyToScan = visible && permission?.granted;

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
    setScanStatus(`Read ${value}`);
    Promise.resolve(onBarcodeScanned(value, result))
      .catch((error) => {
        setScanStatus(error instanceof Error ? error.message : "Could not use the scanned barcode.");
      })
      .finally(() => {
        setTimeout(() => {
          busyRef.current = false;
        }, 1200);
      });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close scanner">
              <Ionicons name="close" size={24} color={tokens.colors.textSecondary} />
            </Pressable>
          </View>

          {readyToScan ? (
            <View style={styles.cameraShell}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                animateShutter
                onCameraReady={() => setScannerReady(true)}
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
              <Ionicons name="camera-outline" size={34} color={tokens.colors.primaryStrong} />
              <Text style={styles.permissionTitle}>{permissionDenied ? "Camera permission disabled" : "Requesting camera access"}</Text>
              <Text style={styles.permissionText}>
                Camera access is required to scan barcodes. Enable camera permission in Settings if it was denied.
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title={permissionDenied ? "Open settings" : permission?.granted ? "Retry" : "Allow camera"}
                    onPress={async () => {
                      if (permissionDenied) {
                        await Linking.openSettings().catch(() => Alert.alert("Open settings", "Please enable camera access in your device settings."));
                        return;
                      }
                      setPermissionRequested(true);
                      await requestPermission();
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: tokens.colors.overlay,
    padding: 16,
    justifyContent: "center"
  },
  card: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: 16,
    gap: 14,
    ...tokens.shadow.modal
  },
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  title: {
    color: tokens.colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  subtitle: {
    color: tokens.colors.textSecondary,
    lineHeight: 18,
    fontSize: 12
  },
  cameraShell: {
    minHeight: 420,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#050816",
    borderWidth: 1,
    borderColor: tokens.colors.border
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
    borderColor: tokens.colors.primaryStrong,
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
    borderColor: tokens.colors.primaryStrong,
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
    borderColor: tokens.colors.primaryStrong,
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
    borderColor: tokens.colors.primaryStrong,
    borderBottomRightRadius: 20
  },
  cameraFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "rgba(2, 6, 23, 0.72)",
    gap: 4
  },
  cameraHint: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  },
  cameraHintSecondary: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    lineHeight: 18
  },
  permissionCard: {
    gap: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  permissionTitle: {
    color: tokens.colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center"
  },
  permissionText: {
    color: tokens.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20
  },
  actions: {
    flexDirection: "row",
    gap: 10
  }
});
