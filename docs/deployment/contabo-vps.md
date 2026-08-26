# TraceForge Contabo VPS Deployment Guide

This guide covers the end-to-end process of deploying the TraceForge production stack onto a Contabo VPS.

## Prerequisites
- A Contabo VPS running **Ubuntu 22.04** or **24.04**.
- A domain name (`usetraceforge.com`) managed by Cloudflare.

---

## 1. Cloudflare DNS Setup

Before logging into your VPS, set up your DNS records in Cloudflare so that they point to your VPS IP address.

1. Log into Cloudflare and select `usetraceforge.com`.
2. Go to **DNS** -> **Records**.
3. Add the following records:
   - **Type `A`**: Name: `@` (or `usetraceforge.com`), Content: `YOUR_VPS_IP_ADDRESS`
   - **Type `A`**: Name: `www`, Content: `YOUR_VPS_IP_ADDRESS`
4. **SSL/TLS Mode**: Go to **SSL/TLS** -> **Overview** and set it to **Full (Strict)**.

> [!TIP]
> Using Cloudflare proxy (the orange cloud) automatically gives you a free SSL certificate without having to install Certbot manually on your server!

---

## 2. Server Provisioning

SSH into your new VPS as the root user.

```bash
ssh root@<YOUR_VPS_IP>
```

Update the system and install essential packages:

```bash
apt update && apt upgrade -y
apt install -y git curl wget ufw
```

Set up the UFW Firewall to allow HTTP, HTTPS, and SSH:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## 3. Install Docker & Docker Compose

TraceForge runs entirely in Docker containers. Install the official Docker engine:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

Verify the installation:

```bash
docker --version
docker compose version
```

---

## 4. Clone and Configure TraceForge

Clone your repository into the `/opt` directory:

```bash
cd /opt
git clone https://github.com/khushalp2004/TraceForge.git traceforge
cd traceforge
```

Copy the environment template:

```bash
cp .env.example .env
```

Edit the `.env` file using a text editor (like `nano .env`):

> **IMPORTANT**: The following variables **must** be updated for production!

```env
# 1. URLs
FRONTEND_URL=https://usetraceforge.com
WEB_BASE_URL=https://usetraceforge.com
NEXT_PUBLIC_API_URL=https://usetraceforge.com
NEXT_PUBLIC_SUPPORT_EMAIL=team@usetraceforge.com

# 2. Passwords (Change these to strong random strings)
POSTGRES_PASSWORD=your_secure_db_password
DATABASE_URL=postgresql://traceforge:your_secure_db_password@db:5432/traceforge
JWT_SECRET=your_secure_jwt_secret

# 3. Environment
NODE_ENV=production

# 4. Razorpay (Use Test keys for now until KYC is approved, then update to Live)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

---

## 5. Build and Start the Stack

With your configuration complete, spin up the entire TraceForge architecture:

```bash
docker compose up -d --build
```

Docker will download the necessary base images, build the Next.js frontend, compile the Node.js backend/workers, and start PostgreSQL, Redis, PgBouncer, and Nginx.

Check that all containers are running successfully:

```bash
docker compose ps
```

---

## 6. Verification & Razorpay Next Steps

1. Open your browser and navigate to `https://usetraceforge.com`. You should see the TraceForge landing page.
2. Ensure you can create an account and log into the dashboard.
3. Now that your website is **live**, Razorpay will automatically scan it.
4. Once Razorpay approves your KYC (usually 24-48 hours), generate your **Live API Keys**.
5. SSH back into your server:
   ```bash
   cd /opt/traceforge
   nano .env
   # Update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the live keys
   # Update the RAZORPAY_PLAN_*_ID variables to your live plans
   ```
6. Restart the stack to apply the new keys:
   ```bash
   docker compose down
   docker compose up -d
   ```

You are now fully deployed and ready to accept real payments!
