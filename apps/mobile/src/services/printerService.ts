import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";

type BluetoothModule = {
  BluetoothManager?: Record<string, (...args: any[]) => Promise<any> | any>;
  BluetoothEscposPrinter?: Record<string, (...args: any[]) => Promise<any> | any>;
};

export async function copyReceipt(receiptText: string) {
  await Clipboard.setStringAsync(receiptText);
}

export async function shareReceipt(receiptText: string) {
  await Share.share({
    message: receiptText,
    title: "Receipt"
  });
}

export async function printBluetoothReceipt(receiptText: string) {
  let module: BluetoothModule;
  try {
    module = (await import("@brooons/react-native-bluetooth-escpos-printer")) as unknown as BluetoothModule;
  } catch {
    throw new Error("Bluetooth printer module is not installed in this build.");
  }
  const bluetoothManager = module.BluetoothManager;
  const printer = module.BluetoothEscposPrinter;

  if (!bluetoothManager || !printer) {
    throw new Error("Bluetooth printer module is not available in this build.");
  }

  await ensureBluetoothEnabled(bluetoothManager);
  const address = await resolvePrinterAddress(bluetoothManager);
  if (!address) {
    throw new Error("No paired Bluetooth printer found.");
  }

  await invoke(bluetoothManager, ["connect", "connectPrinter", "connectDevice"], address);
  const lines = receiptText.replace(/\r/g, "").split("\n");
  for (const line of lines) {
    await invoke(printer, ["printText"], `${line}\n`, {});
  }
  await invoke(printer, ["printText"], "\n\n", {});
}

async function ensureBluetoothEnabled(manager: Record<string, (...args: any[]) => Promise<any> | any>) {
  const enabled = await invoke(manager, ["isBluetoothEnabled", "isEnabled"]);
  if (enabled === true) return;
  if (typeof manager.enableBluetooth === "function") {
    await manager.enableBluetooth();
    return;
  }
  throw new Error("Enable Bluetooth on the device first.");
}

async function resolvePrinterAddress(manager: Record<string, (...args: any[]) => Promise<any> | any>) {
  const bonded = await invoke(manager, ["getBondedDevices", "pairedDevices", "scanDevices"]);
  if (!bonded) return null;
  if (Array.isArray(bonded)) {
    return extractAddress(bonded[0]);
  }
  if (Array.isArray(bonded.devices)) {
    return extractAddress(bonded.devices[0]);
  }
  return extractAddress(bonded[0]);
}

function extractAddress(value: any) {
  if (!value) return null;
  return String(value.address ?? value.macAddress ?? value.id ?? value.deviceAddress ?? "").trim() || null;
}

async function invoke(target: Record<string, (...args: any[]) => Promise<any> | any>, names: string[], ...args: any[]) {
  for (const name of names) {
    const fn = target[name];
    if (typeof fn === "function") {
      return fn.apply(target, args);
    }
  }
  return undefined;
}
