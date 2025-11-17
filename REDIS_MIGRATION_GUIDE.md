# Redis Migration Guide: Upstash Cloud → Local VPS

Panduan lengkap untuk migrasi dari Upstash Cloud Redis ke Redis lokal di VPS.

## 📋 Table of Contents

1. [Persiapan](#persiapan)
2. [Instalasi Redis](#instalasi-redis)
3. [Update Backend Code](#update-backend-code)
4. [Testing](#testing)
5. [Deployment](#deployment)
6. [Rollback Plan](#rollback-plan)
7. [FAQ](#faq)

---

## 1. Persiapan

### Checklist Sebelum Migrasi

- [ ] VPS sudah ready (minimal 2GB RAM)
- [ ] SSH access ke VPS
- [ ] Backup database & data penting
- [ ] Catat konfigurasi Upstash yang sekarang
- [ ] Siapkan waktu maintenance (estimasi 30-60 menit)

### Catat Info Upstash Saat Ini

```bash
# Dari file .env saat ini
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
UPSTASH_REDIS_URL=rediss://xxx@xxx.upstash.io:6379
```

**Simpan info ini sebagai backup!**

---

## 2. Instalasi Redis

### Opsi A: Automatic Installation (Recommended)

```bash
# 1. Login ke VPS
ssh root@your-vps-ip

# 2. Clone repository (atau upload script)
cd /root
git clone https://github.com/yourusername/HalloWa.id.git
cd HalloWa.id/scripts

# 3. Jalankan installer
bash setup-redis-vps.sh

# 4. SIMPAN OUTPUT INI!
# Copy Redis URL yang muncul:
# UPSTASH_REDIS_URL=redis://default:PASSWORD@127.0.0.1:6379
```

**Output yang akan muncul:**
```
✅ Redis Installation Completed!
==========================================

Redis URL for .env:
UPSTASH_REDIS_URL=redis://default:AbCdEf1234567890@127.0.0.1:6379

⚠️  IMPORTANT: Save this password!
```

### Opsi B: Manual Installation

<details>
<summary>Klik untuk lihat langkah manual</summary>

```bash
# Update system
sudo apt update

# Install Redis
sudo apt install redis-server -y

# Edit config
sudo nano /etc/redis/redis.conf

# Ubah baris ini:
# bind 127.0.0.1
# requirepass YOUR_STRONG_PASSWORD_HERE
# maxmemory 512mb
# maxmemory-policy allkeys-lru

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test
redis-cli -a YOUR_PASSWORD ping
# Should return: PONG
```

</details>

---

## 3. Update Backend Code

### Step 1: Update Dependencies (Optional)

```bash
cd railway-service

# ioredis sudah ada, tapi pastikan versi terbaru
npm install ioredis@latest
```

### Step 2: Update Environment Variables

Edit file `railway-service/.env`:

```bash
# ========================================
# REDIS CONFIGURATION
# ========================================

# Option 1: Local Redis (VPS) - RECOMMENDED
# Comment out Upstash REST API
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=

# Use TCP connection (works for both local & Upstash)
UPSTASH_REDIS_URL=redis://default:YOUR_PASSWORD@127.0.0.1:6379

# ========================================
```

**⚠️ PENTING:**
- Ganti `YOUR_PASSWORD` dengan password dari step instalasi
- Pastikan tidak ada spasi atau enter tambahan
- Jangan commit file .env ke Git!

### Step 3: Update Redis Client (PILIH SALAH SATU)

#### Opsi A: Use Universal Client (Recommended)

```bash
# Backup client lama
cd railway-service
mv redis-client.js redis-client-old.js

# Rename universal client
mv redis-client-universal.js redis-client.js

# DONE! Universal client auto-detect TCP atau REST
```

#### Opsi B: Keep Old Client (Fallback)

Jika mau tetap pakai client lama tapi support lokal:

```bash
# Tidak perlu ubah apa-apa!
# Client lama akan fallback ke config/redis.js yang sudah support local
```

### Step 4: Verify Configuration

```bash
# Check syntax error
node -c redis-client.js

# Should return nothing (means OK)
```

---

## 4. Testing

### Step 1: Test Redis Connection

```bash
# Di VPS, test Redis
redis-cli -a YOUR_PASSWORD ping
# Expected: PONG

# Test set/get
redis-cli -a YOUR_PASSWORD
> SET test "Hello Local Redis"
> GET test
> EXIT
```

### Step 2: Test Backend Service

```bash
cd railway-service

# Start service
npm start

# Atau dengan PM2
pm2 start index.js --name hallowa-backend
pm2 logs
```

**Expected output:**
```
✅ Redis connected via TCP (ioredis)
   Mode: LOCAL Redis
✅ Redis ready for operations
```

### Step 3: Test dari Frontend

```bash
# Test broadcast kecil (5-10 kontak)
# Monitor Redis:
bash /root/HalloWa.id/scripts/monitor-redis.sh --watch

# Lihat apakah:
# - QR code disimpan
# - Rate limiting bekerja
# - Cache berfungsi
```

### Step 4: Performance Test

```bash
# Install redis-benchmark (jika belum)
sudo apt install redis-tools -y

# Test performance
redis-benchmark -a YOUR_PASSWORD -q -n 10000

# Expected results (local Redis):
# SET: ~50,000-100,000 ops/sec
# GET: ~80,000-150,000 ops/sec
#
# Compare dengan Upstash:
# SET: ~500-2,000 ops/sec
# GET: ~1,000-3,000 ops/sec
#
# Local = 50-100x FASTER! 🚀
```

---

## 5. Deployment

### Production Deployment Checklist

- [ ] Backup database terlebih dahulu
- [ ] Set maintenance mode (optional)
- [ ] Update .env dengan Redis lokal
- [ ] Restart backend service
- [ ] Monitor logs selama 15 menit
- [ ] Test semua fitur utama:
  - [ ] Device connection (QR code)
  - [ ] Send broadcast
  - [ ] Scheduled messages
  - [ ] API rate limiting
- [ ] Disable maintenance mode

### Restart Services

```bash
# Dengan PM2
pm2 restart hallowa-backend
pm2 logs --lines 50

# Atau dengan systemd
sudo systemctl restart hallowa-backend
sudo journalctl -u hallowa-backend -f

# Atau dengan Docker
docker-compose restart backend
docker-compose logs -f backend
```

### Monitor First Hour

```bash
# Terminal 1: Monitor Redis
bash /root/HalloWa.id/scripts/monitor-redis.sh --watch

# Terminal 2: Monitor Backend Logs
pm2 logs hallowa-backend

# Terminal 3: Monitor System Resources
htop
```

**Red Flags to Watch:**
- ❌ Redis connection errors
- ❌ Memory usage >90%
- ❌ High CPU usage (>80%)
- ❌ Broadcast failures
- ❌ QR code not showing

---

## 6. Rollback Plan

Kalau ada masalah serius, rollback ke Upstash:

### Quick Rollback (5 menit)

```bash
# 1. Edit .env
cd railway-service
nano .env

# 2. Uncomment Upstash config
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
UPSTASH_REDIS_URL=rediss://xxx@xxx.upstash.io:6379

# 3. Restart
pm2 restart hallowa-backend

# 4. Verify
pm2 logs
# Should see: "Redis initialized via REST API (Upstash)"
```

### Full Rollback (dengan backup code)

```bash
# Restore old redis-client
cd railway-service
mv redis-client.js redis-client-universal-backup.js
mv redis-client-old.js redis-client.js

# Restore .env
cp .env.backup .env

# Restart
pm2 restart all
```

---

## 7. FAQ

### Q: Apakah data Redis hilang saat migrasi?

**A:** TIDAK ada data yang hilang karena:
- Redis hanya untuk data sementara (QR code, cache, rate limit)
- Data persisten ada di PostgreSQL (Supabase)
- QR code baru akan digenerate otomatis
- Cache akan rebuild otomatis

### Q: Bagaimana kalau VPS restart?

**A:** Redis akan auto-start karena sudah di-enable dengan systemd:
```bash
sudo systemctl enable redis-server
```

### Q: Apakah perlu backup Redis?

**A:** OPTIONAL, karena data tidak kritikal. Tapi kalau mau:
```bash
# Auto backup setiap hari jam 2 pagi
crontab -e
# Add:
0 2 * * * /root/HalloWa.id/scripts/backup-redis.sh
```

### Q: Redis kehabisan memory, gimana?

**A:** Redis auto-evict data lama (LRU policy):
```bash
# Cek usage
redis-cli -a PASSWORD INFO memory

# Kalau perlu, flush manual
redis-cli -a PASSWORD FLUSHALL
```

### Q: Bisakah pakai Redis lokal + Upstash bersamaan?

**A:** BISA! Universal client prioritas TCP (lokal) dulu, fallback ke REST:
```bash
# .env
UPSTASH_REDIS_URL=redis://localhost...  # Priority 1
UPSTASH_REDIS_REST_URL=https://...      # Backup
UPSTASH_REDIS_REST_TOKEN=xxx
```

### Q: Performance comparison?

**A:**
| Operation | Upstash (Cloud) | Redis Local (VPS) |
|-----------|-----------------|-------------------|
| SET | 50-200ms | **0.1-1ms** |
| GET | 30-150ms | **0.1-1ms** |
| INCR | 40-100ms | **0.1-0.5ms** |
| Throughput | 500-2000 ops/s | **50,000-100,000 ops/s** |

**Local = 50-100x FASTER!** 🚀

### Q: Apakah aman?

**A:** YA, selama:
- ✅ Redis bind ke 127.0.0.1 (localhost only)
- ✅ Password 32 karakter strong
- ✅ Firewall block port 6379 dari luar
- ✅ Regular update Redis

### Q: Monitoring & alerting?

**A:** Gunakan monitoring script:
```bash
# Manual check
bash /root/HalloWa.id/scripts/monitor-redis.sh

# Continuous monitoring
bash /root/HalloWa.id/scripts/monitor-redis.sh --watch
```

---

## 📊 Comparison Table

| Aspect | Upstash Cloud | Redis Local (VPS) |
|--------|---------------|-------------------|
| **Setup Time** | 5 minutes | 10-15 minutes |
| **Monthly Cost** | $0-$20 | $0 (included in VPS) |
| **Latency** | 50-200ms | 0.1-1ms ⚡ |
| **Throughput** | 2K ops/s | 100K ops/s ⚡ |
| **Maintenance** | Zero | Low (monthly update) |
| **Scalability** | Auto | Manual (add RAM) |
| **Backup** | Auto | Manual (script provided) |
| **Best For** | Serverless, Low traffic | VPS, High traffic |

---

## ✅ Post-Migration Checklist

Setelah 24 jam berjalan stabil:

- [ ] Remove Upstash credentials dari .env (hemat biaya)
- [ ] Setup auto-backup Redis (cron job)
- [ ] Monitor memory usage trend
- [ ] Optimize max memory jika perlu
- [ ] Document new setup untuk tim
- [ ] Update deployment documentation

---

## 🆘 Emergency Contacts

Jika ada masalah:

1. **Check logs:** `pm2 logs` atau `journalctl -u redis-server -f`
2. **Check Redis:** `bash /root/HalloWa.id/scripts/monitor-redis.sh`
3. **Rollback:** Follow "Rollback Plan" section
4. **Support:** Create issue di GitHub repository

---

## 📝 Notes

- Migrasi ini **NON-DESTRUCTIVE** (tidak ada data hilang)
- Bisa rollback kapan saja dalam 5 menit
- Recommended: Test di staging environment dulu
- Waktu terbaik: Saat traffic rendah (malam/weekend)

**Good luck!** 🚀
