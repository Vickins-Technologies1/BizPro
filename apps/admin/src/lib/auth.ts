import { hash, verify } from "@node-rs/argon2";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { passkey } from "@better-auth/passkey";
import { createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { MongoClient, ObjectId } from "mongodb";
import nodemailer from "nodemailer";
import { createHmac } from "node:crypto";
import { isPlatformAdminRole } from "@vbo/shared";

const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32
} as const;

export function hashAdminPassword(password: string) {
  return hash(password, ARGON2_OPTIONS);
}

const globalForAdminAuth = globalThis as typeof globalThis & { __diraAdminMongoClient?: MongoClient };

export function getAdminMongoClient() {
  if (!globalForAdminAuth.__diraAdminMongoClient) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is required for the DIRA OS admin console");
    globalForAdminAuth.__diraAdminMongoClient = new MongoClient(uri, { maxPoolSize: 10, minPoolSize: 0, serverSelectionTimeoutMS: 10_000 });
  }
  return globalForAdminAuth.__diraAdminMongoClient;
}

export function getAdminMongoDb() {
  return getAdminMongoClient().db(process.env.MONGODB_DB_NAME || "vickins_business_os");
}

const baseURL = process.env.BETTER_AUTH_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
if (!baseURL) throw new Error("BETTER_AUTH_URL must be configured in production");
if (process.env.NODE_ENV === "production" && !baseURL.startsWith("https://")) {
  throw new Error("BETTER_AUTH_URL must use HTTPS in production");
}

const smtpPort = Number(process.env.SMTP_PORT || 587);

export const adminAuth = betterAuth({
  appName: "DIRA OS Admin",
  baseURL,
  basePath: "/admin-auth",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [...new Set([baseURL, process.env.ADMIN_PUBLIC_URL].filter((value): value is string => Boolean(value)))],
  database: mongodbAdapter(getAdminMongoDb()),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: (password) => hashAdminPassword(password),
      verify: ({ hash: storedHash, password }) => verify(storedHash, password, ARGON2_OPTIONS)
    },
    sendResetPassword: async ({ user, url }) => {
      const host = process.env.SMTP_HOST;
      const sender = process.env.MAIL_FROM_ADDRESS;
      if (!host || !sender) throw new Error("Admin password reset email delivery is not configured");
      const transporter = nodemailer.createTransport({
        host,
        port: Number.isInteger(smtpPort) && smtpPort > 0 ? smtpPort : 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM_NAME ? `${process.env.MAIL_FROM_NAME} <${sender}>` : sender,
        to: user.email,
        subject: "Reset your DIRA OS Admin password",
        text: `Use this secure link to reset your password. It expires shortly: ${url}`
      });
    }
  },
  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "read_only", input: false },
      isActive: { type: "boolean", required: true, defaultValue: true, input: false },
      title: { type: "string", required: false, input: false }
    }
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 30,
    freshAge: 60 * 10,
    revokeOnPasswordReset: true
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 }
    }
  },
  advanced: {
    cookiePrefix: "dira-admin",
    useSecureCookies: process.env.NODE_ENV === "production"
  },
  plugins: [twoFactor({ issuer: "DIRA OS Admin" }), passkey()],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const userId = String(session.userId);
          const user = await getAdminMongoDb().collection("user").findOne(
            { $or: [{ id: userId }, ...(ObjectId.isValid(userId) ? [{ _id: new ObjectId(userId) }] : [])] },
            { projection: { isActive: 1, role: 1 } }
          );
          if (!user || user.isActive === false || !isPlatformAdminRole(user.role)) return false;
          return { data: session };
        }
      }
    }
  },
  hooks: {
    after: createAuthMiddleware(async (context) => {
      if (context.path === "/sign-out") {
        const session = context.context.session;
        if (session) {
          await writeAdminLoginEvent({
            email: session.user.email,
            adminId: session.user.id,
            outcome: "success",
            reason: "signed_out",
            ipAddress: context.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
            userAgent: context.headers?.get("user-agent") ?? null
          });
        }
        return;
      }
      if (context.path !== "/sign-in/email") return;
      const returned = context.context.returned as { status?: number; body?: { code?: string } } | undefined;
      const createdSession = context.context.newSession;
      const email = typeof context.body?.email === "string" ? context.body.email.trim().toLowerCase() : "";
      await writeAdminLoginEvent({
        email,
        adminId: createdSession?.user.id ?? null,
        outcome: createdSession ? "success" : "failure",
        reason: createdSession ? "authenticated" : returned?.body?.code ?? "invalid_credentials",
        ipAddress: context.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: context.headers?.get("user-agent") ?? null
      });
    })
  }
});

async function writeAdminLoginEvent(input: {
  email: string;
  adminId: string | null;
  outcome: "success" | "failure";
  reason: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const safeAgent = input.userAgent?.slice(0, 300) ?? null;
  try {
    const ipHash = input.ipAddress
      ? createHmac("sha256", process.env.BETTER_AUTH_SECRET || "").update(input.ipAddress).digest("hex")
      : null;
    await getAdminMongoDb().collection("platform_admin_login_events").insertOne({
      adminId: input.adminId,
      email: input.email.slice(0, 254),
      outcome: input.outcome,
      reason: input.reason.slice(0, 120),
      ipHash,
      userAgent: safeAgent,
      createdAt: new Date()
    });
  } catch {
    // Authentication must remain available if the auxiliary login-history write is temporarily unavailable.
  }
}
