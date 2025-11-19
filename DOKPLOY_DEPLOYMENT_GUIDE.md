# 🚀 Dokploy Deployment Guide - HalloWa.id

Panduan lengkap deploy HalloWa.id ke Dokploy (VPS/Self-hosted Platform)

## 📋 Prerequisites

- VPS dengan minimum 2GB RAM, 2 vCPU, 20GB storage
- Dokploy sudah terinstall di VPS
- Domain sudah di-pointing ke VPS (optional, bisa pakai IP)
- Akun Supabase (free tier)

## 🏗️ Arsitektur Deployment

```
┌─────────────────────────────────────────────────────┐
│                    DOKPLOY VPS                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────┐    ┌──────────────────┐     │
│  │  Frontend (Web)  │    │  Backend (API)   │     │
│  │  Port: 80/443    │───▶│  Port: 3000      │     │
│  │  Vite/React      │    │  Node.js/Baileys │     │
│  └──────────────────┘    └──────────────────┘     │
│           │                       │                 │
│           │              ┌────────┴────────┐        │
│           │              │                  │        │
│           │         ┌────▼─────┐    ┌──────▼────┐  │
│           │         │  Redis   │    │  Bull     │  │
│           │         │  (Cache) │◀───│  Queue    │  │
│           │         └──────────┘    └───────────┘  │
│           │                                         │
│           └─────────────────────────────────────────┤
│                         │                            │
└─────────────────────────┼────────────────────────────┘
                          │
                ┌─────────▼────────────┐
                │  Supabase Cloud      │
                │  - PostgreSQL        │
                │  - Auth              │
                │  - Realtime          │
                │  - Edge Functions    │
                │  - Storage           │
                └──────────────────────┘
```

## 📝 Step-by-Step Deployment

### Step 1: Setup Redis di Dokploy

1. Login ke Dokploy Dashboard
2. Buka Project HalloWa.id (atau buat baru)
3. Klik **Add Service** → **Database** → **Redis**
4. Konfigurasi:
   ```yaml
   Service Name: hallowa-redis
   Redis Version: 7-alpine
   Port: 6379
   Password: [Generate random password]
   ```
5. Klik **Create**
6. Tunggu hingga status **Running**
7. **PENTING**: Copy connection string dari tab "Connection"
   ```
   Format: redis://default:[password]@hallowa-redis:6379
   ```

### Step 2: Setup Backend (Railway Service)

1. Di Dokploy, klik **Add Service** → **Application** → **Git**
2. Konfigurasi Git:
   ```yaml
   Service Name: hallowa-backend
   Repository: [Your Git Repository URL]
   Branch: main
   Build Path: /railway-service
   ```

3. **Environment Variables** (tab "Environment"):

   Klik **Add Variable** dan masukkan satu per satu:

   ```bash
   # Database (dari Supabase)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # Redis (dari Step 1)
   REDIS_URL=redis://default:[password]@hallowa-redis:6379

   # Server Configuration
   PORT=3000
   NODE_ENV=production
   LOG_LEVEL=info

   # Security (GENERATE NEW KEY!)
   INTERNAL_API_KEY=[Generate dengan: openssl rand -base64 32]

   # Optional: Server ID (auto-generated jika kosong)
   # SERVER_ID=[UUID dari https://www.uuidgenerator.net/]

   # Monitoring (Optional)
   MONITORING_PORT=3001
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=[Your secure password]
   ```

4. **Build Settings** (tab "Build"):
   ```yaml
   Build Command: npm install
   Start Command: npm start
   Working Directory: railway-service
   ```

5. **Port Mapping**:
   - Internal Port: `3000`
   - External Port: `3000` (atau custom)
   - Protocol: `HTTP`

6. Klik **Deploy**

7. **Copy Backend URL** setelah deploy sukses:
   ```
   Format: http://[your-vps-ip]:3000
   atau: https://backend.yourdomain.com (jika pakai domain)
   ```

### Step 3: Konfigurasi Supabase Edge Functions

1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project Anda
3. Pergi ke **Edge Functions** → **Manage Secrets**
4. Tambahkan secrets berikut:

   ```bash
   INTERNAL_API_KEY=[Same value dari Backend env var]
   RAILWAY_SERVICE_URL=[Backend URL dari Step 2]
   ```

   Contoh:
   ```bash
   INTERNAL_API_KEY=K8Jd9mP2nQ5rT7vX1wZ3yA6bC8eF0gH4iJ7kL9mN2oP5qR8sT0uV3wX6yZ9aB1cD4
   RAILWAY_SERVICE_URL=http://168.xxx.xxx.xxx:3000
   ```

5. **Deploy Edge Functions** (via Supabase CLI):
   ```bash
   cd /path/to/HalloWa.id
   npx supabase functions deploy --project-ref your-project-ref
   ```

### Step 4: Setup Frontend

1. Di Dokploy, klik **Add Service** → **Application** → **Git**
2. Konfigurasi Git:
   ```yaml
   Service Name: hallowa-frontend
   Repository: [Your Git Repository URL]
   Branch: main
   Build Path: /
   ```

3. **Environment Variables**:
   ```bash
   # Supabase
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key

   # Build
   NODE_ENV=production
   ```

4. **Build Settings**:
   ```yaml
   Build Command: npm install && npm run build
   Start Command: npx vite preview --host 0.0.0.0 --port 8080
   Output Directory: dist
   ```

5. **Port Mapping**:
   - Internal Port: `8080`
   - External Port: `80` atau `443` (dengan SSL)
   - Protocol: `HTTP` atau `HTTPS`

6. **Domain Setup** (Optional):
   - Klik tab "Domain"
   - Add domain: `hallowa.yourdomain.com`
   - Enable SSL/TLS (Let's Encrypt)

7. Klik **Deploy**

### Step 5: Verifikasi Deployment

#### 5.1 Check Backend Health

```bash
# Via curl
curl http://[backend-url]:3000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-11-19T01:30:00.000Z",
  "activeConnections": 0
}
```

#### 5.2 Check Logs

1. Di Dokploy Dashboard:
   - Klik service **hallowa-backend**
   - Tab **Logs**
   - Cari output seperti:
     ```
     ✅ Server identified successfully
     serverId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

     ✅ Redis connected (local TCP)
     ✅ BullMQ worker started
     🌐 HTTP Server listening on port 3000
     ```

2. **IMPORTANT**: Copy **serverId** dari log untuk Step 6

#### 5.3 Check Frontend

1. Buka browser: `http://[your-domain-or-ip]`
2. Test signup/login
3. Check console untuk errors

### Step 6: Register Backend Server di Database

Backend server perlu didaftarkan di database agar bisa assign devices.

**Via Supabase SQL Editor**:

1. Buka Supabase Dashboard → SQL Editor
2. Run query berikut (ganti values dengan yang sesuai):

```sql
-- Check if server already exists
SELECT * FROM public.backend_servers
WHERE id = 'your-server-id-from-logs'::uuid;

-- If not exists, insert new server
INSERT INTO public.backend_servers (
  id,
  server_name,
  server_url,
  server_type,
  region,
  max_capacity,
  priority,
  is_active,
  is_healthy
) VALUES (
  'your-server-id-from-logs'::uuid,
  'Dokploy Production',
  'http://[your-vps-ip]:3000',
  'vps',
  'ID', -- atau region Anda
  100, -- max devices
  10, -- priority (higher = preferred)
  true,
  true
);
```

**Via Admin Panel** (Preferred):

1. Login sebagai admin di frontend
2. Pergi ke **Admin** → **Backend Servers**
3. Klik **Add Server**
4. Isi form:
   ```
   Server ID: [UUID dari logs]
   Server Name: Dokploy Production
   Server URL: http://[your-vps-ip]:3000
   Server Type: vps
   Region: ID
   Max Capacity: 100
   Priority: 10
   ```
5. Klik **Save**

### Step 7: Test WhatsApp Connection

1. Login ke frontend
2. Pergi ke **Devices** → **Add Device**
3. Masukkan device name
4. Pilih connection method: **QR Code** atau **Pairing Code**
5. Scan QR atau input pairing code
6. Tunggu hingga status **Connected**

---

## 🔧 Troubleshooting

### Error: "invalid input syntax for type uuid"

**Problem**: Server ID bukan UUID yang valid

**Solution**:
1. Update kode di `railway-service/services/server/serverIdentifier.js` (sudah fixed di commit terbaru)
2. Atau set `SERVER_ID` env var dengan UUID yang valid:
   ```bash
   SERVER_ID=550e8400-e29b-41d4-a716-446655440000
   ```
3. Redeploy backend service

### Error: "INTERNAL_API_KEY not set or too short"

**Problem**: Internal API key tidak diset atau terlalu pendek

**Solution**:
1. Generate API key:
   ```bash
   openssl rand -base64 32
   ```
2. Set di Backend env vars:
   ```bash
   INTERNAL_API_KEY=K8Jd9mP2nQ5rT7vX1wZ3yA6bC8eF0gH4iJ7kL9mN2oP5qR8sT0uV3wX6yZ9aB1cD4
   ```
3. Set di Supabase Edge Function secrets dengan value yang SAMA
4. Redeploy

### Error: "Redis connection failed"

**Problem**: Backend tidak bisa connect ke Redis

**Solution**:
1. Pastikan Redis service running di Dokploy
2. Check `REDIS_URL` env var format:
   ```bash
   redis://default:password@hallowa-redis:6379
   ```
3. Pastikan backend dan Redis dalam network yang sama di Dokploy
4. Test connection dari backend container:
   ```bash
   # Exec ke container backend
   docker exec -it [backend-container-id] sh

   # Test Redis
   nc -zv hallowa-redis 6379
   ```

### Error: "Failed to fetch assigned devices"

**Problem**: Server belum registered di database

**Solution**:
Follow **Step 6** untuk register server via SQL atau Admin Panel

### Device Status Stuck di "Connecting"

**Problem**: Backend tidak bisa establish WhatsApp connection

**Solutions**:
1. Check backend logs untuk detailed error
2. Pastikan port 3000 tidak di-block firewall
3. Check Redis connection (QR/pairing codes disimpan di Redis)
4. Restart backend service
5. Clear device dan reconnect

### Frontend: "Network Error" atau "Failed to fetch"

**Problem**: Frontend tidak bisa connect ke Supabase

**Solutions**:
1. Check `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`
2. Check browser console untuk detailed error
3. Verify Supabase project tidak suspended
4. Check CORS settings di Supabase jika pakai custom domain

---

## 🔒 Security Checklist

- [ ] `INTERNAL_API_KEY` minimum 32 characters
- [ ] `REDIS_URL` password strong (min 16 chars)
- [ ] `ADMIN_PASSWORD` untuk BullBoard dashboard strong
- [ ] SSL/TLS enabled untuk frontend (HTTPS)
- [ ] Supabase RLS policies enabled
- [ ] Firewall rules: only allow necessary ports (80, 443, 3000)
- [ ] Regular backups untuk Supabase database
- [ ] Monitor logs untuk suspicious activity

---

## 📊 Monitoring & Maintenance

### Access BullBoard Dashboard

URL: `http://[backend-url]:3001/admin/queues`
Username: `admin` (dari env var `ADMIN_USERNAME`)
Password: [dari env var `ADMIN_PASSWORD`]

Features:
- View pending/active/completed jobs
- Retry failed broadcasts
- Monitor queue performance

### Check Server Health

```bash
# Backend health
curl http://[backend-url]:3000/health

# Redis health
docker exec -it [redis-container] redis-cli ping
# Expected: PONG

# Check logs
# Via Dokploy Dashboard → Logs
```

### Database Monitoring

Via Supabase Dashboard:
- **Database** → **Query Performance**
- **Database** → **Disk Usage**
- **Auth** → **Users**
- **Storage** → **Usage**

### Maintenance Tasks

**Weekly**:
- [ ] Check error logs for anomalies
- [ ] Monitor disk usage (alert jika >80%)
- [ ] Review failed broadcasts in BullBoard
- [ ] Check device connection logs

**Monthly**:
- [ ] Update dependencies (`npm outdated`)
- [ ] Review security logs
- [ ] Database backup verification
- [ ] Performance review (query slow logs)

---

## 🚀 Scaling Tips

### Horizontal Scaling (Multiple Backend Servers)

1. Deploy multiple backend services di Dokploy dengan nama berbeda:
   ```
   hallowa-backend-1 (Jakarta)
   hallowa-backend-2 (Singapore)
   ```

2. Set unique `SERVER_ID` untuk setiap instance:
   ```bash
   # Backend 1
   SERVER_ID=550e8400-e29b-41d4-a716-446655440001

   # Backend 2
   SERVER_ID=550e8400-e29b-41d4-a716-446655440002
   ```

3. Register semua servers di database (Step 6)

4. Load balancing otomatis via `get_best_available_server()` function

### Vertical Scaling (Increase Resources)

Di Dokploy:
1. Stop service
2. Edit service → Resources
3. Increase CPU/RAM:
   ```
   Recommended for 100 devices:
   - CPU: 2 vCPU
   - RAM: 4 GB
   - Disk: 40 GB
   ```
4. Restart service

### Redis Optimization

```bash
# Increase Redis max memory
# Edit redis.conf di container
maxmemory 2gb
maxmemory-policy allkeys-lru
```

---

## 📚 Additional Resources

- [Dokploy Documentation](https://docs.dokploy.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Baileys WhatsApp Library](https://github.com/WhiskeySockets/Baileys)
- [BullMQ Documentation](https://docs.bullmq.io/)

---

## 🆘 Support

Jika masih ada masalah:

1. Check logs di:
   - Dokploy Dashboard → Service → Logs
   - Supabase Dashboard → Edge Functions → Logs
   - Browser Console (F12)

2. Baca error message dengan teliti

3. Search di dokumentasi atau GitHub issues

4. Contact admin/developer dengan informasi lengkap:
   - Error message
   - Logs
   - Steps yang sudah dilakukan
   - Environment details (OS, Dokploy version, etc)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Maintainer**: HalloWa.id Team
