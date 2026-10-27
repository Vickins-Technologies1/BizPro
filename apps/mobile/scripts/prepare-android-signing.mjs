import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const requiredSecrets = [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
];

for (const name of requiredSecrets) {
  if (!process.env[name]) {
    throw new Error(`Required protected environment secret is missing: ${name}`);
  }
}

const encodedKeystore = process.env.ANDROID_KEYSTORE_BASE64;
if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedKeystore)) {
  throw new Error('ANDROID_KEYSTORE_BASE64 is not valid base64.');
}

const keystore = Buffer.from(encodedKeystore, 'base64');
if (keystore.length === 0) {
  throw new Error('The configured Android keystore is empty.');
}

const mobileRoot = process.cwd();
const credentialsDirectory = resolve(mobileRoot, 'credentials/android');
const keystorePath = resolve(credentialsDirectory, 'keystore.jks');
const credentialsPath = resolve(mobileRoot, 'credentials.json');

await mkdir(credentialsDirectory, { recursive: true });
await writeFile(keystorePath, keystore, { mode: 0o600 });
await writeFile(
  credentialsPath,
  `${JSON.stringify(
    {
      android: {
        keystore: {
          keystorePath: 'credentials/android/keystore.jks',
          keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
          keyAlias: process.env.ANDROID_KEY_ALIAS,
          keyPassword: process.env.ANDROID_KEY_PASSWORD,
        },
      },
    },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);

console.log('Android local signing files prepared in ignored paths.');
