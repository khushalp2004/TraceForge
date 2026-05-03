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
  // Use standalone output for optimized production Docker build
  output: "standalone",
  
  // Optimize images for CDN
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // Enable compression for better performance
  compress: true,
  
  // Optimize production builds
  swcMinify: true,
  
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  
  // Optimize for static generation where possible
  // Pages will be pre-rendered at build time if they don't use getServerSideProps
  generateEtags: true,
  
  // Power header configuration for Cloudflare CDN
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      // Cache static assets with long TTL
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      // Don't cache API routes
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
