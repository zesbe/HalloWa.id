# ⚡ Quick Fix Guide - Dokploy Errors

Solusi cepat untuk error umum di Dokploy deployment.

---

## ❌ Error: "invalid input syntax for type uuid"

```
[ERROR] ❌ Failed to register server {
  serverId: '9217a56e9052',
  error: 'invalid input syntax for type uuid: "9217a56e9052"'
}
```

### Root Cause
Server ID dari hostname bukan format UUID yang valid. Database `backend_servers.id` butuh UUID.

### Quick Fix

**Option 1: Pull Latest Code** (Recommended)
```bash
# Update code dengan fix terbaru
git pull origin main
cd railway-service
npm install

# Redeploy di Dokploy
# Dokploy akan auto-generate UUID v5 dari hostname
```

**Option 2: Set Manual UUID**
```bash
# Generate UUID
uuidgen  # atau visit https://www.uuidgenerator.net/

# Set di Dokploy environment variables:
SERVER_ID=550e8400-e29b-41d4-a716-446655440000

# Restart service
```

### Verify Fix
```bash
# Check logs, harus muncul:
✅ Server identified successfully
serverId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
```

---

## ⚠️ Warning: "INTERNAL_API_KEY not set or too short"

```
⚠️  WARNING: INTERNAL_API_KEY not set or too short. Edge function authentication will fail.
```

### Root Cause
Environment variable `INTERNAL_API_KEY` tidak diset atau kurang dari 32 karakter.

### Quick Fix

**Step 1: Generate API Key**
```bash
# Linux/Mac:
openssl rand -base64 32

# Output example:
# K8Jd9mP2nQ5rT7vX1wZ3yA6bC8eF0gH4iJ7kL9mN2oP5qR8sT0uV3wX6yZ9aB1cD4

# Atau gunakan online generator:
# https://generate-random.org/api-key-generator (pilih 32+ chars)
```

**Step 2: Set di Backend (Dokploy)**
1. Buka Dokploy Dashboard
2. Service `hallowa-backend` → **Environment**
3. Add/Edit variable:
   ```
   Name: INTERNAL_API_KEY
   Value: [Paste generated key]
   ```
4. **Save** → **Restart** service

**Step 3: Set di Supabase Edge Functions**
1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Your Project → **Edge Functions** → **Manage Secrets**
3. Add secret:
   ```
   Name: INTERNAL_API_KEY
   Value: [SAME key dari Step 2]
   ```
4. **Save**

**Step 4: Redeploy Edge Functions**
```bash
cd /path/to/HalloWa.id
npx supabase functions deploy --project-ref your-project-ref
```

### Verify Fix
```bash
# Check backend logs - warning should disappear
# Edge functions should now work
```

---

## 🔴 Error: "Redis connection failed"

```
❌ Redis connection failed
```

### Root Cause
Backend tidak bisa connect ke Redis service.

### Quick Fix

**Step 1: Verify Redis Running**
```bash
# Di Dokploy Dashboard
# Service list → hallowa-redis → Status harus "Running"
```

**Step 2: Check Connection String**
```bash
# Di Dokploy
# Service hallowa-redis → Connection

# Format harus:
redis://default:[password]@hallowa-redis:6379

# Atau jika internal network:
redis://default:[password]@[redis-service-name]:6379
```

**Step 3: Update Backend Environment**
```bash
# Di Dokploy
# Service hallowa-backend → Environment

REDIS_URL=redis://default:[password-dari-redis-service]@hallowa-redis:6379
```

**Step 4: Restart Backend**
```bash
# Dokploy Dashboard → hallowa-backend → Restart
```

### Verify Fix
```bash
# Check logs:
✅ Redis connected (local TCP)
✅ ioredis connected to local Redis (TCP native protocol)
✅ Redis ready for operations
```

---

## 🚫 Error: "Failed to fetch assigned devices"

```
[ERROR] ❌ Failed to fetch assigned devices {
  serverId: 'xxx-xxx-xxx',
  error: '...'
}
```

### Root Cause
Server belum terdaftar di database `backend_servers` table.

### Quick Fix

**Option 1: Via SQL (Fastest)**

1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Your Project → **SQL Editor** → **New query**
3. Copy server ID dari backend logs:
   ```
   serverId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
   ```
4. Run query (ganti `your-server-id` dan values):
   ```sql
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
     'Dokploy Production Server',
     'http://your-vps-ip:3000',
     'vps',
     'ID',
     100,
     10,
     true,
     true
   )
   ON CONFLICT (id) DO UPDATE SET
     is_active = true,
     is_healthy = true,
     updated_at = NOW();
   ```
5. **Run** query

**Option 2: Via Admin Panel**

1. Login ke frontend sebagai admin
2. **Admin** → **Backend Servers** → **Add Server**
3. Fill form:
   ```
   Server ID: [dari logs]
   Server Name: Dokploy Production
   Server URL: http://[vps-ip]:3000
   Server Type: vps
   Region: ID
   Max Capacity: 100
   Priority: 10
   ```
4. **Save**

### Verify Fix
```bash
# Check logs - error should disappear
# Devices should now be assigned to server
```

---

## 🔌 Error: "Port 3000 is already in use"

```
❌ Port 3000 is already in use
🔄 Trying alternative port...
🌐 HTTP Server listening on port 45345
```

### Root Cause
Port 3000 sudah digunakan oleh process lain atau duplicate service.

### Quick Fix

**Step 1: Check Running Processes**
```bash
# Via Dokploy exec terminal
lsof -i :3000
# atau
netstat -tulpn | grep 3000
```

**Step 2: Kill Conflicting Process**
```bash
kill -9 [PID]
```

**Step 3: Atau Ganti Port**
```bash
# Di Dokploy Environment Variables
PORT=3001  # atau port lain yang available

# Restart service
```

**Step 4: Update Firewall/Port Mapping**
```bash
# Pastikan port baru accessible
# Update di Dokploy Port Mapping
```

### Verify Fix
```bash
# Logs should show:
🌐 HTTP Server listening on port 3000
```

---

## 📡 Error: "Health check server running on port 3000" tapi tidak bisa diakses

### Root Cause
Firewall atau port mapping belum dikonfigurasi.

### Quick Fix

**Step 1: Check Firewall**
```bash
# Di VPS (SSH)
sudo ufw status
sudo ufw allow 3000/tcp
```

**Step 2: Check Dokploy Port Mapping**
```bash
# Di Dokploy Dashboard
# Service hallowa-backend → Ports

# Tambahkan mapping:
Internal: 3000
External: 3000
Protocol: HTTP
```

**Step 3: Test dari Luar**
```bash
# Dari local machine
curl http://[vps-ip]:3000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "...",
  "activeConnections": 0
}
```

---

## 🔄 Device Stuck di "Connecting"

### Root Cause
Multiple kemungkinan: Redis issue, QR expired, or backend error.

### Quick Fix

**Step 1: Check Backend Logs**
```bash
# Di Dokploy Dashboard → Logs
# Cari error messages terkait device
```

**Step 2: Verify Redis Working**
```bash
# Redis harus bisa store QR codes
# Check logs:
✅ Redis ready for operations
```

**Step 3: Clear Device & Retry**
```bash
# Di Frontend
# Devices → [Your Device] → Delete
# Add new device → Try again dengan QR/Pairing baru
```

**Step 4: Check Session Data**
```bash
# Pastikan device bisa save session ke database
# Check backend logs untuk "Session saved" messages
```

---

## 🌐 Frontend: "Network Error" atau CORS Error

### Root Cause
Frontend tidak bisa connect ke Supabase atau environment variables salah.

### Quick Fix

**Step 1: Verify Environment Variables**
```bash
# Di Dokploy frontend service → Environment

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Get dari Supabase Dashboard → Settings → API
```

**Step 2: Rebuild Frontend**
```bash
# Di Dokploy
# Service hallowa-frontend → Redeploy
```

**Step 3: Check Browser Console**
```bash
# Press F12 → Console
# Look for detailed error messages
```

**Step 4: Verify Supabase CORS**
```bash
# Supabase Dashboard → Authentication → URL Configuration
# Tambahkan frontend domain/IP ke allowed origins
```

---

## 🔍 Debugging Tips

### Enable Debug Logs

```bash
# Di Dokploy Backend Environment
LOG_LEVEL=debug

# Restart service
# Logs akan lebih verbose
```

### Check All Services Status

```bash
# Quick checklist:
✅ Redis: Running
✅ Backend: Running + logs show no errors
✅ Frontend: Running + accessible
✅ Supabase: Project active
✅ Edge Functions: Deployed
```

### Test Individual Components

```bash
# Test Redis
docker exec -it [redis-container] redis-cli ping
# Expected: PONG

# Test Backend
curl http://[backend-url]:3000/health
# Expected: {"status":"ok",...}

# Test Supabase
curl https://[project].supabase.co/rest/v1/
# Expected: JSON response (might be error but proves connectivity)
```

---

## 📞 Still Having Issues?

### Collect Debugging Info

```bash
# Backend logs
# Dokploy → hallowa-backend → Logs → Copy last 100 lines

# Frontend logs
# Browser F12 → Console → Copy errors

# Redis logs
# Dokploy → hallowa-redis → Logs

# Environment vars (HIDE SECRETS!)
# List all set variables
```

### Common Questions to Answer

1. What's the exact error message?
2. When did it start happening?
3. What changed recently? (code update, config change, etc)
4. Can you access other parts of the app?
5. Are all services running in Dokploy?
6. What's the backend/frontend URL?

---

**Last Updated**: 2025-11-19
**Quick Reference Version**: 1.0.0
