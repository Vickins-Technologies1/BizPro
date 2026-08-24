import React from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tokens } from "@/theme/tokens";
import { PrimaryButton } from "@/components/Primitives";

type BarcodeScannerModalProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onBarcodeScanned: (barcode: string, raw?: unknown) => void | Promise<void>;
};

type ScannerContentProps = Omit<BarcodeScannerModalProps, "visible"> & {
  visible: boolean;
};

export function BarcodeScannerModal({ visible, title = "Scan barcode", subtitle = "Point the camera at a product barcode", onClose, onBarcodeScanned }: BarcodeScannerModalProps) {
  const [ScannerContent, setScannerContent] = React.useState<React.ComponentType<ScannerContentProps> | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible || ScannerContent || loadError) {
      return;
    }

    let cancelled = false;

    import("./BarcodeScannerModalContent")
      .then((module) => {
        if (cancelled) return;
        setScannerContent(() => module.BarcodeScannerModalContent);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error && error.message ? error.message : "The barcode scanner is unavailable on this device.");
      });

    return () => {
      cancelled = true;
    };
  }, [ScannerContent, loadError, visible]);

  React.useEffect(() => {
    if (!visible) {
      setLoadError(null);
    }
  }, [visible]);

  function handleRetry() {
    setLoadError(null);
    setScannerContent(null);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {ScannerContent ? (
        <ScannerContent visible={visible} title={title} subtitle={subtitle} onClose={onClose} onBarcodeScanned={onBarcodeScanned} />
      ) : (
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

            <View style={styles.loadingState}>
              {loadError ? <Ionicons name="camera-outline" size={34} color={tokens.colors.primaryStrong} /> : <ActivityIndicator size="large" color={tokens.colors.primaryStrong} />}
              <Text style={styles.loadingTitle}>{loadError ? "Scanner unavailable" : "Starting scanner"}</Text>
              <Text style={styles.loadingText}>
                {loadError ?? "Loading the camera module only when you open the scanner keeps the POS and catalog screens stable."}
              </Text>
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title={loadError ? "Try again" : "Cancel"} variant="secondary" onPress={loadError ? handleRetry : onClose} />
                </View>
                {loadError ? (
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Cancel" variant="secondary" onPress={onClose} />
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      )}
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
  loadingState: {
    gap: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  loadingTitle: {
    color: tokens.colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center"
  },
  loadingText: {
    color: tokens.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    width: "100%"
  }
});
