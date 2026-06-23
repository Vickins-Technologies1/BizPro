declare const process: { env: { EXPO_PUBLIC_API_URL?: string } };

export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api"
} as const;
