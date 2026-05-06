# Cloudflare CDN Configuration

## DNS Setup

1. **Add your domain to Cloudflare**
   - Go to Cloudflare Dashboard → Add Site
   - Enter your domain
   - Select Free plan
   - Update nameservers to Cloudflare's nameservers

2. **Configure DNS Records**
   ```
   Type: A
   Name: @ (root)
   Content: YOUR_VPS_IP
   Proxy status: Proxied (orange cloud)
   TTL: Auto
   
   Type: A
   Name: www
   Content: YOUR_VPS_IP
   Proxy status: Proxied (orange cloud)
   TTL: Auto
   ```

## Cache Rules (Cloudflare Dashboard → Caching → Cache Rules)

### Rule 1: Cache Static Assets (Priority: High)
```
Rule Name: Cache Static Assets
Status: Enabled
Match:
  - URI Path Matches Pattern: /_next/static/*
  - OR URI Path Matches Pattern: /static/*
  - OR URI Path Matches Pattern: /images/*
  - OR File Extension Matches: jpg, jpeg, png, gif, svg, webp, avif, ico, woff, woff2, ttf, otf, eot, css, js
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 year (31536000 seconds)
  - Browser Cache TTL: 1 year (31536000 seconds)
  - Cache Key: Cache by URL
```

### Rule 2: Bypass API Routes (Priority: High)
```
Rule Name: Bypass API Routes
Status: Enabled
Match:
  - URI Path Matches Pattern: /api/*
Settings:
  - Cache Level: Bypass
  - Disable Performance features: On
```

### Rule 3: Cache Dashboard Endpoint (Priority: Medium)
```
Rule Name: Cache Dashboard API
Status: Enabled
Match:
  - URI Path Matches Pattern: /dashboard
  - Cookie: (none)
Settings:
  - Cache Level: Standard
  - Edge Cache TTL: 30 seconds (for semi-dynamic content)
  - Browser Cache TTL: 30 seconds
  - Origin Cache Control: On
```

### Rule 4: Bypass Auth Routes (Priority: High)
```
Rule Name: Bypass Auth Routes
Status: Enabled
Match:
  - URI Path Matches Pattern: /auth/*
  - OR URI Path Contains: /login
  - OR URI Path Contains: /signup
Settings:
  - Cache Level: Bypass
  - Disable Performance features: On
```

## Page Rules (Alternative to Cache Rules)

If Cache Rules are not available, use Page Rules:

### Page Rule 1: Cache Static Assets
```
URL Pattern: *yourdomain.com/_next/static/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 year
  - Browser Cache TTL: 1 year
```

### Page Rule 2: Cache Images
```
URL Pattern: *yourdomain.com/images/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 year
  - Browser Cache TTL: 1 year
```

### Page Rule 3: Bypass Cache for API
```
URL Pattern: *yourdomain.com/api/*
Settings:
  - Cache Level: Bypass
  - Disable Performance features
```

## Performance Settings (Cloudflare Dashboard → Speed → Optimization)

### Auto Minify
- ✅ JavaScript: On
- ✅ CSS: On
- ✅ HTML: On

### Brotli
- ✅ Enable Brotli: On

### HTTP/3 (QUIC)
- ✅ HTTP/3: On

### Rocket Loader
- ✅ Automatic: On

### 0-RTT Connection Resumption
- ✅ 0-RTT: On

## Security Settings (Cloudflare Dashboard → Security)

### Bot Fight Mode
- ✅ Enable: On

### Security Level
- Set to: Medium

### Rate Limiting
- Create rule for API endpoint if needed:
  ```
  Rule Name: API Rate Limit
  Match: URI Path contains /api/
  Rate Limit: 100 requests per minute
  Action: Challenge
  ```

## SSL/TLS (Cloudflare Dashboard → SSL/TLS)

### Overview
- Mode: Full (strict)
- Always Use HTTPS: On
- Automatic HTTPS Rewrites: On

### Edge Certificates
- Always Use HTTPS: On
- HTTP Strict Transport Security (HSTS): On
  - Max-Age: 31536000 (1 year)
  - Include Subdomains: On
  - Preload: Off

## Testing

### 1. Check Cache Headers
```bash
curl -I https://yourdomain.com/_next/static/chunks/main.js
# Should return: Cache-Control: public, max-age=31536000, immutable
```

### 2. Check API Cache Bypass
```bash
curl -I https://yourdomain.com/api/auth/me
# Should return: Cache-Control: no-store, no-cache, must-revalidate
```

### 3. Check Cloudflare Cache Status
```bash
curl -I https://yourdomain.com/_next/static/chunks/main.js
# Should return: CF-Cache-Status: HIT (after first request)
```

## Expected Results

- **Static assets**: 70-90% cache hit rate
- **Frontend memory**: Reduced from 512MB to 256MB
- **Backend load**: Reduced by ~40-50% (static assets served from CDN)
- **Global latency**: 50-70% improvement for static assets
- **Bandwidth**: Reduced by ~60% (compression + caching)
- **Dashboard**: 30-second edge cache reduces backend load by ~30%

## Rollback Plan

If issues occur:
1. Disable Cache Rules temporarily
2. Switch to DNS-only mode (grey cloud)
3. Revert to original NGINX config
4. Check Cloudflare Analytics for errors
