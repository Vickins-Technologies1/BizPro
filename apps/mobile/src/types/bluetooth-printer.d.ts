declare module "@brooons/react-native-bluetooth-escpos-printer" {
  export const BluetoothManager: Record<string, (...args: any[]) => Promise<any> | any>;
  export const BluetoothEscposPrinter: Record<string, (...args: any[]) => Promise<any> | any>;
}
