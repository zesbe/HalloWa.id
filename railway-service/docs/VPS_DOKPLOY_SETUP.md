# Setup HalloWa.id di VPS Dokploy - Troubleshooting Guide

## 🚨 Masalah: QR Code Tidak Muncul di VPS

Jika QR code berhasil muncul di Railway tapi **tidak muncul di VPS Dokploy**, kemungkinan besar karena:

1. ❌ `INTERNAL_API_KEY` tidak di-set → Edge function gagal authenticate
2. ❌ `SERVER_URL` tidak di-set → Server tercatat dengan `localhost` yang tidak accessible
3. ❌ Port conflict → Server jalan di port berbeda dari yang ter-register
4. ❌ Firewall VPS block port → Frontend/Edge function tidak bisa reach backend
5. ❌ Redis connection issue → QR code tidak ter-cache (sebenarnya minor karena QR disimpan di database)

---

## ✅ Solusi Step-by-Step

### Step 1: Tentukan IP Public VPS

Cari tau IP public VPS Anda:

```bash
# Di VPS, jalankan:
curl ifconfig.me
# Atau
curl api.ipify.org
```

Misal hasilnya: `103.xxx.xxx.xxx`

---

### Step 2: Set Environment Variables di Dokploy

Buka Dokploy → Pilih service backend → Environment Variables, **TAMBAHKAN/UPDATE** berikut:

#### ✅ WAJIB Ada:

```bash
# 1. SERVER IDENTIFICATION (IMPORTANT!)
SERVER_ID=dokploy-vps-1
# Buat unique ID untuk VPS ini (alphanumeric, dash, underscore)

# 2. SERVER URL (CRITICAL!)
SERVER_URL=http://103.xxx.xxx.xxx:3000
# ⚠️ GANTI dengan IP public VPS Anda!
# Format: http://<IP_PUBLIC>:<PORT>
# Jangan pakai localhost/127.0.0.1!

# 3. SERVER INFO (OPTIONAL tapi recommended)
SERVER_NAME=VPS-Dokploy-Production
SERVER_TYPE=vps
SERVER_REGION=asia-southeast
SERVER_MAX_CAPACITY=50
SERVER_PRIORITY=0

# 4. INTERNAL API KEY (CRITICAL!)
INTERNAL_API_KEY=your_super_secret_key_min_32_characters_here
# ⚠️ Generate dengan: openssl rand -base64 32
# ⚠️ HARUS SAMA dengan yang di Supabase Edge Functions!

# 5. PORT (FIX PORT 3000)
PORT=3000
# Set explicit supaya tidak conflict

# 6. SUPABASE
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 7. REDIS
REDIS_URL=redis://default:password@your-redis-host:6379
# Sesuaikan dengan Redis Dokploy Anda
```

#### 📋 Cara Generate INTERNAL_API_KEY:

```bash
# Jalankan di terminal:
openssl rand -base64 32
```

Copy hasilnya ke environment variable **INTERNAL_API_KEY**.

**PENTING:** Key ini **HARUS SAMA** dengan yang ada di Supabase Edge Functions!

---

### Step 3: Set INTERNAL_API_KEY di Supabase Edge Functions

Buka **Supabase Dashboard** → Settings → Edge Functions → Secrets:

Tambahkan secret:
- **Name:** `INTERNAL_API_KEY`
- **Value:** (paste key yang sama dari Step 2)

Atau via CLI:

```bash
npx supabase secrets set INTERNAL_API_KEY=your_super_secret_key_min_32_characters_here
```

---

### Step 4: Fix Port Conflict di Dokploy

**Opsi A: Stop service yang pakai port 3000**

```bash
# Cek siapa yang pakai port 3000
sudo lsof -i :3000
# atau
sudo netstat -tulpn | grep :3000

# Kill process tersebut
sudo kill -9 <PID>
```

**Opsi B: Gunakan port lain (misal 3001)**

Di environment variables Dokploy:

```bash
PORT=3001
SERVER_URL=http://103.xxx.xxx.xxx:3001
```

Jangan lupa update firewall untuk allow port baru!

---

### Step 5: Setup Firewall VPS

Pastikan port yang digunakan **OPEN** di firewall:

```bash
# Untuk UFW (Ubuntu)
sudo ufw allow 3000/tcp
sudo ufw reload
sudo ufw status

# Untuk Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports

# Untuk iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables-save
```

**Jangan lupa:** Jika pakai cloud provider (DigitalOcean, Vultr, AWS, etc), cek juga **Security Group** di dashboard provider!

---

### Step 6: Restart Service di Dokploy

Setelah set semua env vars:

1. Buka Dokploy Dashboard
2. Pilih service backend
3. Klik **Restart** atau **Redeploy**

---

### Step 7: Verifikasi Server Registration

Setelah restart, cek log Dokploy untuk memastikan:

```
✅ Server auto-registered successfully {
  serverId: 'dokploy-vps-1',
  serverName: 'VPS-Dokploy-Production',
  serverUrl: 'http://103.xxx.xxx.xxx:3000'  ← HARUS IP PUBLIC!
}
```

**Jika masih `http://localhost:3000`** → env vars belum ke-load, restart lagi!

---

### Step 8: Cek Database

Buka Supabase → Table Editor → `backend_servers`:

Pastikan ada entry untuk VPS Dokploy dengan:
- ✅ `server_url` = IP public (bukan localhost!)
- ✅ `is_active` = true
- ✅ `is_healthy` = true
- ✅ `current_load` = jumlah devices yang ter-assign

**Jika server_url masih localhost:**

```sql
-- Update manual di Supabase SQL Editor:
UPDATE backend_servers
SET server_url = 'http://103.xxx.xxx.xxx:3000'
WHERE id = 'dokploy-vps-1';
```

---

### Step 9: Test Koneksi dari Luar VPS

Dari komputer lokal, test apakah backend bisa diakses:

```bash
# Test health endpoint
curl http://103.xxx.xxx.xxx:3000/health

# Seharusnya return:
{"status":"ok","timestamp":"...","server":"dokploy-vps-1"}
```

**Jika gagal:**
- ❌ Firewall block → Buka port
- ❌ Backend tidak jalan → Cek log Dokploy
- ❌ IP salah → Cek ulang IP public

---

### Step 10: Coba Connect Device

1. Buka frontend HalloWa.id
2. Klik **Add Device**
3. Pilih metode **QR Code** atau **Pairing Code**
4. Klik **Connect**

**Cek di database tabel `devices`:**
- ✅ `assigned_server_id` = `dokploy-vps-1`
- ✅ `status` = `connecting`
- ✅ `qr_code` atau `pairing_code` = ada value (bukan null!)

**Cek log Dokploy:**

```
📷 QR Code generated for DEVICE-NAME
✅ QR stored in Supabase - scan with WhatsApp app
```

**Jika QR tetap tidak muncul:**
- Cek log untuk error message
- Cek `INTERNAL_API_KEY` sudah benar di Supabase dan Dokploy
- Cek network connectivity dari Supabase ke VPS

---

## 🔍 Troubleshooting Checklist

### ✅ Environment Variables Checklist

```bash
# Jalankan di container Dokploy untuk verify env vars loaded:
echo $SERVER_ID          # ✅ Harus ada (dokploy-vps-1)
echo $SERVER_URL         # ✅ Harus IP public (http://103.xxx.xxx.xxx:3000)
echo $INTERNAL_API_KEY   # ✅ Harus ada & min 32 char
echo $PORT               # ✅ Harus match dengan SERVER_URL
echo $REDIS_URL          # ✅ Harus ada
echo $SUPABASE_URL       # ✅ Harus ada
echo $SUPABASE_SERVICE_ROLE_KEY  # ✅ Harus ada
```

### ✅ Network Checklist

```bash
# 1. Cek port listening
netstat -tulpn | grep :3000
# ✅ Harus ada process node listening di 0.0.0.0:3000

# 2. Cek firewall
sudo ufw status
# ✅ Port 3000 harus ALLOW

# 3. Test dari luar
curl http://<IP_PUBLIC>:3000/health
# ✅ Harus return JSON {"status":"ok"}
```

### ✅ Redis Checklist

```bash
# Test Redis connection dari container:
redis-cli -h <redis-host> -p 6379 -a <password> ping
# ✅ Harus return PONG

# Atau via Node.js REPL di container:
node -e "const Redis = require('ioredis'); const r = new Redis(process.env.REDIS_URL); r.ping().then(console.log)"
# ✅ Harus return PONG
```

---

## 🐛 Common Errors & Solutions

### Error 1: "INTERNAL_API_KEY not set or too short"

**Penyebab:** Env var tidak ada atau kurang dari 32 karakter

**Solusi:**
```bash
# Generate key:
openssl rand -base64 32

# Set di Dokploy env vars:
INTERNAL_API_KEY=<hasil_generate>

# Set di Supabase Edge Functions secrets juga!
```

---

### Error 2: "Port 3000 is already in use"

**Penyebab:** Ada service lain pakai port 3000

**Solusi A - Kill process lain:**
```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

**Solusi B - Pakai port lain:**
```bash
PORT=3001
SERVER_URL=http://103.xxx.xxx.xxx:3001
```

---

### Error 3: "server_url: 'http://localhost:3000'"

**Penyebab:** SERVER_URL env var tidak ke-load

**Solusi:**
1. Set `SERVER_URL=http://<IP_PUBLIC>:3000` di Dokploy env vars
2. Restart service
3. Cek log untuk confirm
4. Jika masih localhost, update manual di database:

```sql
UPDATE backend_servers
SET server_url = 'http://103.xxx.xxx.xxx:3000'
WHERE id = 'dokploy-vps-1';
```

---

### Error 4: QR Code Tidak Muncul di Frontend

**Penyebab:** Edge function tidak bisa reach backend VPS

**Cek:**
1. ✅ INTERNAL_API_KEY sama di Dokploy & Supabase?
2. ✅ SERVER_URL pakai IP public (bukan localhost)?
3. ✅ Port open di firewall?
4. ✅ Backend jalan di port yang benar?

**Test manual:**
```bash
# Dari Supabase Edge Function, simulate request:
curl -H "Authorization: Bearer <INTERNAL_API_KEY>" \
     http://103.xxx.xxx.xxx:3000/health
```

---

### Error 5: "Stream Errored (conflict)"

**Penyebab:** Device sudah connect di server lain (Railway)

**Solusi:**
1. Disconnect device dari Railway dulu
2. Atau matikan service Railway
3. Wait 30 detik
4. Coba connect lagi di VPS

---

## 📊 Monitoring After Deployment

### 1. Cek Server Health di Admin Panel

Buka frontend → Admin → Server Management:

- ✅ Server VPS Dokploy muncul
- ✅ Status: Active
- ✅ Health: Healthy
- ✅ Response time < 1000ms
- ✅ Current load sesuai jumlah devices

### 2. Cek Device Assignment

Buka frontend → Devices:

- ✅ Device ter-assign ke server VPS Dokploy
- ✅ Status: Connected
- ✅ Assigned Server ID: dokploy-vps-1

### 3. Monitor Logs

Di Dokploy, monitor log untuk:

```
✅ Server auto-registered successfully
✅ Device auto-assigned
📷 QR Code generated
✅ QR stored in Supabase
✅ Connected: DEVICE-NAME
```

---

## 🎯 Final Checklist Before Going Live

```
[ ] ✅ SERVER_ID di-set unique
[ ] ✅ SERVER_URL pakai IP public + port benar
[ ] ✅ INTERNAL_API_KEY min 32 char & sama dengan Supabase
[ ] ✅ PORT explicitly set (3000 atau lainnya)
[ ] ✅ REDIS_URL connect ke Redis Dokploy
[ ] ✅ SUPABASE credentials benar
[ ] ✅ Firewall VPS allow port backend
[ ] ✅ Cloud provider security group allow port
[ ] ✅ Backend health endpoint accessible dari luar
[ ] ✅ Server ter-register di database dengan URL benar
[ ] ✅ QR code muncul saat add device
[ ] ✅ Device bisa connect via QR/pairing code
[ ] ✅ Logs tidak ada error critical
```

---

## 📞 Masih Bermasalah?

Jika setelah follow semua step masih bermasalah, share info berikut:

1. **Log Dokploy** (saat start & saat add device)
2. **Screenshot frontend** (saat add device)
3. **Database query result:**
   ```sql
   SELECT id, server_name, server_url, is_active, is_healthy, current_load
   FROM backend_servers
   WHERE id = 'dokploy-vps-1';
   ```
4. **Test curl result:**
   ```bash
   curl http://<IP_PUBLIC>:3000/health
   ```

Good luck! 🚀
