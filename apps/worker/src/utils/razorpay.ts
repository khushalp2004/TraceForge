import crypto from "node:crypto";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

export const getRazorpayKeys = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";

  return { keyId, keySecret };
};

export const assertConfigured = () => {
  const { keyId, keySecret } = getRazorpayKeys();

  if (!keyId || !keySecret) {
    throw Object.assign(
      new Error(`Razorpay is not configured (missing keys)`),
      { status: 501 }
    );
  }

  return { keyId, keySecret };
};

export const razorpayRequest = async <T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> => {
  const { keyId, keySecret } = assertConfigured();
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = (await res.json().catch(() => null)) as any;

  if (!res.ok) {
    const errorMsg = data?.error?.description || `Razorpay request failed (${res.status})`;
    throw Object.assign(new Error(errorMsg), { status: res.status });
  }

  return data as T;
};
