# BizTrack Baileys WhatsApp Gateway

A lightweight, zero-Meta-fee WhatsApp Web Multi-Device microservice built with [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys).

---

## 1. Local Development
Run directly from your project root:
```bash
pnpm whatsapp:gateway
```
- Listens on `http://localhost:5055`
- BizTrack automatically connects to this gateway in development!

---

## 2. Production Deployment Options

Because WhatsApp Multi-Device requires a **persistent 24/7 WebSocket connection** to WhatsApp's servers (unlike stateless serverless functions on Vercel), the gateway must run on a persistent container or server:

### Option A: Docker / Docker Compose (Recommended for VPS)
On any Ubuntu/Linux VPS (DigitalOcean, Hetzner, AWS, etc.):
```bash
cd tools/whatsapp-gateway
docker compose up -d
```
All WhatsApp login credentials and encryption keys persist safely inside the `baileys_auth` volume.

### Option B: PM2 on Ubuntu / VPS
```bash
cd tools/whatsapp-gateway
npm install
npm install -g pm2
pm2 start server.mjs --name "biztrack-whatsapp"
pm2 save
pm2 startup
```

### Option C: 1-Click Cloud (Railway / Render / Coolify)
1. Point Railway or Render to the `tools/whatsapp-gateway` directory.
2. Add a persistent volume mounted to `/app/.baileys_auth`.
3. Set environment variable: `PORT=5055`.
4. Copy your service's public URL (e.g. `https://wa.yourdomain.com`).

---

## 3. Connecting BizTrack in Production
Set the environment variable in your production admin `.env`:
```env
WHATSAPP_GATEWAY_URL=https://wa.yourdomain.com
```
Or in the Admin Dashboard:
Go to **Marketing > WhatsApp > Gateway Settings** and paste your production gateway URL!
