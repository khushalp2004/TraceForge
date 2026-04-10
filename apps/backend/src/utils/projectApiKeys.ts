import crypto from "crypto";

const encryptedPrefix = "enc:";

const resolveEncryptionKey = () => {
  const seed =
    process.env.PROJECT_API_KEYS_ENCRYPTION_KEY?.trim() ||
    process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim();

  if (!seed) {
    throw new Error(
      "PROJECT_API_KEYS_ENCRYPTION_KEY or INTEGRATIONS_ENCRYPTION_KEY must be set"
    );
  }

  return crypto.createHash("sha256").update(seed).digest();
};

const encryptionKey = resolveEncryptionKey();

export const hashProjectApiKey = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

export const isEncryptedProjectApiKey = (value: string) => value.startsWith(encryptedPrefix);

export const encryptProjectApiKey = (value: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${encryptedPrefix}${iv.toString("hex")}.${authTag.toString("hex")}.${encrypted.toString("hex")}`;
};

export const decryptProjectApiKey = (payload: string) => {
  if (!isEncryptedProjectApiKey(payload)) {
    return payload;
  }

  const serialized = payload.slice(encryptedPrefix.length);
  const [ivHex, authTagHex, encryptedHex] = serialized.split(".");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Malformed project API key payload");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
};

export const sealProjectApiKey = (value: string) => ({
  apiKey: encryptProjectApiKey(value),
  apiKeyHash: hashProjectApiKey(value)
});
