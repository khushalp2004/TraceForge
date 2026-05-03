import crypto from "crypto";

const resolveEncryptionKey = () => {
  const seed = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim();

  if (!seed) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY must be set");
  }

  return crypto.createHash("sha256").update(seed).digest();
};

const encryptionKey = resolveEncryptionKey();

export const decryptIntegrationSecret = (payload: string) => {
  const [ivHex, authTagHex, encryptedHex] = payload.split(".");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Malformed integration secret payload");
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
