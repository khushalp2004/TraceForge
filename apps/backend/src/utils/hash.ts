import crypto from "crypto";

export const hashErrorSignature = (message: string, stackTrace: string) => {
  const signature = `${message}\n${stackTrace}`;
  return crypto.createHash("sha256").update(signature).digest("hex");
};
