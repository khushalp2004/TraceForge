import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

export const r2BucketName = process.env.R2_BUCKET_NAME;
export const isR2Configured = Boolean(accountId && accessKeyId && secretAccessKey && r2BucketName);

export const r2Client = isR2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    })
  : null;

/**
 * Uploads a string payload to Cloudflare R2
 */
export async function uploadToR2(key: string, content: string, contentType: string = "application/json"): Promise<void> {
  if (!r2Client || !r2BucketName) throw new Error("R2 is not configured");

  const command = new PutObjectCommand({
    Bucket: r2BucketName,
    Key: key,
    Body: content,
    ContentType: contentType,
  });

  await r2Client.send(command);
}

/**
 * Downloads a string payload from Cloudflare R2
 */
export async function downloadFromR2(key: string): Promise<string> {
  if (!r2Client || !r2BucketName) throw new Error("R2 is not configured");

  const command = new GetObjectCommand({
    Bucket: r2BucketName,
    Key: key,
  });

  const response = await r2Client.send(command);
  if (!response.Body) {
    throw new Error(`Empty response body for R2 key: ${key}`);
  }

  return await response.Body.transformToString();
}
