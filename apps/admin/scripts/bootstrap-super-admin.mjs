import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "@node-rs/argon2";
import { MongoClient, ObjectId } from "mongodb";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const adminDirectory = resolve(scriptDirectory, "..");
const repositoryDirectory = resolve(adminDirectory, "..", "..");

for (const file of [
  resolve(adminDirectory, ".env.local"),
  resolve(adminDirectory, ".env"),
  resolve(repositoryDirectory, ".env"),
  resolve(repositoryDirectory, "apps", "api", ".env")
]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const raw = match[2].trim();
    process.env[match[1]] = (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1)
      : raw.replace(/\s+#.*$/, "");
  }
}

if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
  throw new Error("Run this bootstrap command from an interactive terminal so the password can be entered without echo.");
}

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGODB_URI is required.");
if (!process.env.BETTER_AUTH_SECRET || Buffer.byteLength(process.env.BETTER_AUTH_SECRET) < 32) {
  throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 bytes.");
}

const prompt = createInterface({ input: stdin, output: stdout });
const name = (await prompt.question("Super-admin name: ")).trim().slice(0, 120);
const email = (await prompt.question("Super-admin email: ")).trim().toLowerCase();
prompt.close();
if (name.length < 2) throw new Error("Enter a name with at least 2 characters.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email address.");

const password = await readSecret("Password (12–128 characters): ");
const confirmation = await readSecret("Confirm password: ");
if (password !== confirmation) throw new Error("Passwords do not match.");
if (password.length < 12 || password.length > 128) throw new Error("Password must contain 12 to 128 characters.");

const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10_000 });
try {
  await client.connect();
  const database = client.db(process.env.MONGODB_DB_NAME || "vickins_business_os");
  const users = database.collection("user");
  const accounts = database.collection("account");
  const existing = await users.findOne({ email });
  if (existing) throw new Error("An administrator account with this email already exists.");
  const activeSuperAdmins = await users.countDocuments({ role: "super_admin", isActive: { $ne: false } });
  if (activeSuperAdmins > 0) throw new Error("An active Super Admin already exists. Use the authenticated Admin Users module to provision additional administrators.");

  const now = new Date();
  const userId = new ObjectId();
  const passwordHash = await hash(password, { algorithm: 2, memoryCost: 65_536, timeCost: 3, parallelism: 4, outputLen: 32 });
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await users.insertOne({
        _id: userId,
        name,
        email,
        emailVerified: true,
        image: null,
        role: "super_admin",
        isActive: true,
        title: "Platform Owner",
        createdAt: now,
        updatedAt: now
      }, { session });
      await accounts.insertOne({
        _id: new ObjectId(),
        accountId: userId.toHexString(),
        providerId: "credential",
        userId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now
      }, { session });
    });
  } finally {
    await session.endSession();
  }
  stdout.write(`Created the initial Super Admin account for ${email}.\n`);
} finally {
  await client.close();
}

async function readSecret(label) {
  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return await new Promise((resolveSecret, rejectSecret) => {
    let value = "";
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          stdout.write("\n");
          rejectSecret(new Error("Bootstrap cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          stdout.write("\n");
          resolveSecret(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " ") {
          value += character;
        }
      }
    };
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}
