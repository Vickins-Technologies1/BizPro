"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const adminAuthClient = createAuthClient({
  baseURL: typeof window === "undefined" ? process.env.BETTER_AUTH_URL : window.location.origin,
  basePath: "/admin-auth",
  plugins: [twoFactorClient(), passkeyClient()]
});
