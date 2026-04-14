/** @type {import('next').NextConfig} */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL || "";
const isProduction = process.env.NODE_ENV === "production";
const razorpaySources = [
  "https://checkout.razorpay.com",
  "https://api.razorpay.com",
  "https://*.razorpay.com"
];
const connectSources = [
  "'self'",
  apiOrigin,
  ...razorpaySources,
  "https:",
  ...(isProduction ? [] : ["http:", "ws:", "wss:"])
].filter(Boolean);
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline' ${razorpaySources.join(" ")}${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `frame-src 'self' ${razorpaySources.join(" ")}`,
  `connect-src ${connectSources.join(" ")}`,
  "form-action 'self'",
  ...(isProduction ? ["upgrade-insecure-requests"] : [])
];
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()"
  }
];

if (isProduction) {
  securityHeaders.unshift({
    key: "Content-Security-Policy",
    value: cspDirectives.join("; ")
  });
}

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
