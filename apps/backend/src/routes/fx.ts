import { Router } from "express";

type FxProvider = "currencyapi" | "frankfurter";

type CachedFx = {
  rate: number;
  provider: FxProvider;
  asOf: string;
  expiresAt: number;
};

const API_TIMEOUT_MS = 4500;
const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_FALLBACK_RATE = 83;

let cache: CachedFx | null = null;

const getProvider = (): FxProvider => {
  const configured = (process.env.FX_PROVIDER || "").trim().toLowerCase();
  if (configured === "currencyapi") {
    return (process.env.CURRENCYAPI_API_KEY || "").trim() ? "currencyapi" : "frankfurter";
  }
  if (configured === "frankfurter") return "frankfurter";
  if ((process.env.CURRENCYAPI_API_KEY || "").trim()) return "currencyapi";
  return "frankfurter";
};

const getTtlSeconds = () => {
  const raw = Number(process.env.FX_CACHE_TTL_SECONDS || "");
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.max(10, Math.floor(raw)), 6 * 60 * 60);
};

const fetchWithTimeout = async (url: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const fetchUsdInrFromFrankfurter = async (): Promise<{ rate: number; asOf: string }> => {
  const res = await fetchWithTimeout(
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR"
  );
  const data = (await res.json().catch(() => null)) as
    | { rates?: { INR?: number }; date?: string }
    | null;
  if (!res.ok || !data?.rates?.INR) {
    throw new Error("Failed to fetch FX rate from Frankfurter");
  }
  return { rate: Number(data.rates.INR), asOf: data.date ? new Date(`${data.date}T00:00:00Z`).toISOString() : new Date().toISOString() };
};

const fetchUsdInrFromCurrencyApi = async (): Promise<{ rate: number; asOf: string }> => {
  const apiKey = (process.env.CURRENCYAPI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing CURRENCYAPI_API_KEY");
  }

  const res = await fetchWithTimeout(
    "https://api.currencyapi.com/v3/latest?base_currency=USD&currencies=INR",
    {
      headers: {
        apikey: apiKey
      }
    }
  );

  const data = (await res.json().catch(() => null)) as
    | {
        data?: Record<string, { code?: string; value?: number }>;
        meta?: { last_updated_at?: string };
      }
    | null;

  const rate = data?.data?.INR?.value;
  if (!res.ok || !rate) {
    throw new Error("Failed to fetch FX rate from CurrencyAPI");
  }

  const asOf = data?.meta?.last_updated_at
    ? new Date(data.meta.last_updated_at).toISOString()
    : new Date().toISOString();

  return { rate: Number(rate), asOf };
};

const getUsdInr = async (): Promise<CachedFx> => {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache;
  }

  const provider = getProvider();
  const ttlSeconds = getTtlSeconds();

  try {
    const next =
      provider === "currencyapi"
        ? await fetchUsdInrFromCurrencyApi()
        : await fetchUsdInrFromFrankfurter();

    cache = {
      rate: next.rate,
      provider,
      asOf: next.asOf,
      expiresAt: now + ttlSeconds * 1000
    };
    return cache;
  } catch (err) {
    cache = {
      rate: DEFAULT_FALLBACK_RATE,
      provider,
      asOf: new Date().toISOString(),
      expiresAt: now + 60_000
    };
    return cache;
  }
};

export const fxRouter = Router();

fxRouter.get("/usd-inr", async (_req, res) => {
  const fx = await getUsdInr();
  return res.json({
    base: "USD",
    quote: "INR",
    rate: fx.rate,
    provider: fx.provider,
    asOf: fx.asOf
  });
});
