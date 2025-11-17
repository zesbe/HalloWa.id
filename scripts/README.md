# HalloWa.id - VPS Setup Scripts

Kumpulan script automation untuk setup dan maintenance Redis di VPS.

## 📁 Daftar Script

| Script | Fungsi | Durasi |
|--------|--------|--------|
| `setup-redis-vps.sh` | Install & configure Redis otomatis | 2-5 menit |
| `monitor-redis.sh` | Monitor Redis health & performance | Real-time |
| `backup-redis.sh` | Backup Redis data & config | 1-2 menit |
| `restore-redis.sh` | Restore Redis dari backup | 2-3 menit |

---

## 🚀 Quick Start

### 1. Setup Redis (Pertama Kali)

```bash
# Login ke VPS
ssh root@ip-vps-kamu

# Download script (copy dari repo kamu)
cd /root
git clone https://github.com/yourusername/HalloWa.id.git
cd HalloWa.id/scripts

# Jalankan installer
bash setup-redis-vps.sh
```

**Output yang akan muncul:**
```
✅ Redis Installation Completed!
==========================================

Redis URL for .env:
UPSTASH_REDIS_URL=redis://default:AbCdEf1234567890@127.0.0.1:6379
```

**Copy URL di atas ke file `.env` backend kamu!**

---

### 2. Monitor Redis

```bash
# Monitoring sekali
bash monitor-redis.sh

# Monitoring terus-menerus (update setiap 5 detik)
bash monitor-redis.sh --watch
```

**Output:**
```
==========================================
HalloWa.id - Redis Monitor
==========================================

✅ Redis is running

📊 General Info:
  Version: 7.0.15
  Uptime: 2d 14h 32m

💾 Memory:
  Used Memory: 45.2M
  Peak Memory: 128.5M

⚡ Performance:
  Total Commands: 1,245,678
  Hit Rate: 87.5% (good)
```

---

### 3. Backup Redis (Manual)

```bash
# Backup manual
bash backup-redis.sh
```

**Setup Backup Otomatis (Setiap Hari Jam 2 Pagi):**
```bash
# Edit crontab
crontab -e

# Tambahkan baris ini:
0 2 * * * /root/HalloWa.id/scripts/backup-redis.sh >> /var/log/redis-backup.log 2>&1
```

---

### 4. Restore Redis (Kalau Ada Masalah)

```bash
# Lihat backup yang tersedia
ls -lh /root/backups/redis/

# Restore dari backup tertentu
bash restore-redis.sh /root/backups/redis/redis_backup_20250117_020000.tar.gz
```

---

## 📝 Penjelasan Detail

### Setup Redis (`setup-redis-vps.sh`)

**Apa yang dilakukan:**
- ✅ Install Redis Server
- ✅ Generate password acak 32 karakter (aman!)
- ✅ Konfigurasi keamanan (bind localhost only)
- ✅ Set max memory (25% dari RAM VPS, max 2GB)
- ✅ Enable AOF persistence
- ✅ Optimize untuk production
- ✅ Auto-start saat VPS reboot

**File yang dibuat:**
```
/etc/redis/redis.conf           # Konfigurasi Redis
/root/.hallowa/redis-password.txt   # Password (simpan baik-baik!)
/root/.hallowa/redis-config.txt     # Full config info
```

**Requirements:**
- OS: Ubuntu 20.04+ atau Debian 11+
- RAM: Minimal 512MB (recommended 2GB+)
- Harus dijalankan sebagai root atau dengan sudo

---

### Monitor Redis (`monitor-redis.sh`)

**Apa yang ditampilkan:**
- 📊 Uptime & versi
- 👥 Connected clients
- 💾 Memory usage
- ⚡ Cache hit rate
- 🗄️ Database keys
- 🏥 Health status
- 🖥️ CPU & RAM usage

**Mode:**
- `bash monitor-redis.sh` - Sekali lihat
- `bash monitor-redis.sh --watch` - Auto-refresh tiap 5 detik

**Kapan pakai:**
- Cek apakah Redis berjalan normal
- Debugging performance issue
- Monitor saat broadcast besar-besaran
- Lihat cache hit rate

---

### Backup Redis (`backup-redis.sh`)

**Apa yang dibackup:**
- `dump.rdb` - Redis data snapshot
- `appendonly.aof` - AOF log (incremental changes)
- `redis.conf` - Konfigurasi

**Retention:**
- Default: Simpan 7 hari terakhir
- Otomatis hapus backup > 7 hari
- Bisa diubah dengan edit `RETENTION_DAYS` di script

**Lokasi backup:**
```
/root/backups/redis/
  ├── redis_backup_20250117_020000.tar.gz
  ├── redis_backup_20250118_020000.tar.gz
  └── backup_log.txt (history)
```

**Setup auto-backup (Recommended!):**
```bash
# Setiap hari jam 2 pagi
0 2 * * * /root/HalloWa.id/scripts/backup-redis.sh

# Setiap 6 jam
0 */6 * * * /root/HalloWa.id/scripts/backup-redis.sh

# Setiap minggu (Minggu jam 3 pagi)
0 3 * * 0 /root/HalloWa.id/scripts/backup-redis.sh
```

---

### Restore Redis (`restore-redis.sh`)

**Cara pakai:**
```bash
# 1. Lihat backup tersedia
ls -lh /root/backups/redis/

# 2. Pilih backup yang mau direstore
bash restore-redis.sh /root/backups/redis/redis_backup_20250117_020000.tar.gz

# 3. Konfirmasi
Are you sure? (type 'yes' to continue): yes
```

**Safety features:**
- ⚠️ Warning & konfirmasi sebelum restore
- 💾 Auto-backup data current sebelum restore
- 🔄 Auto-rollback kalau restore gagal
- ✅ Verifikasi Redis health setelah restore

**Kapan pakai:**
- Redis corrupt / data hilang
- Salah hapus data penting
- Migration ke VPS baru
- Testing disaster recovery

---

## 🔧 Troubleshooting

### Redis tidak mau start

```bash
# Cek status
systemctl status redis-server

# Lihat error log
journalctl -u redis-server -n 50

# Cek konfigurasi
redis-server /etc/redis/redis.conf --test-memory 1

# Fix permission
chown -R redis:redis /var/lib/redis
chmod 640 /etc/redis/redis.conf
```

### Lupa password Redis

```bash
# Lihat password yang disimpan
cat /root/.hallowa/redis-password.txt

# Atau lihat full config
cat /root/.hallowa/redis-config.txt
```

### Redis kehabisan memory

```bash
# Cek memory usage
redis-cli -a YOUR_PASSWORD INFO memory

# Flush database tertentu
redis-cli -a YOUR_PASSWORD
> SELECT 0
> FLUSHDB

# Flush semua (HATI-HATI!)
> FLUSHALL
```

### Script error "permission denied"

```bash
# Beri permission execute
chmod +x /root/HalloWa.id/scripts/*.sh

# Atau jalankan dengan bash
bash setup-redis-vps.sh
```

---

## 🔐 Security Checklist

✅ **Password:**
- [ ] Password 32 karakter (auto-generated)
- [ ] Simpan di password manager
- [ ] JANGAN commit ke Git

✅ **Network:**
- [ ] Redis bind ke 127.0.0.1 (localhost only)
- [ ] Firewall block port 6379 dari luar
- [ ] Hanya backend service bisa akses

✅ **Backup:**
- [ ] Auto-backup setiap hari
- [ ] Test restore minimal 1x/bulan
- [ ] Simpan backup offsite (S3, etc)

✅ **Monitoring:**
- [ ] Cek Redis health setiap hari
- [ ] Setup alert kalau Redis down
- [ ] Monitor memory usage

---

## 📚 Resources

- [Redis Documentation](https://redis.io/documentation)
- [Redis Security Guide](https://redis.io/topics/security)
- [Redis Persistence](https://redis.io/topics/persistence)
- [Redis Best Practices](https://redis.io/topics/admin)

---

## 🆘 Support

Kalau ada masalah:

1. **Cek log:** `journalctl -u redis-server -f`
2. **Monitor:** `bash monitor-redis.sh`
3. **Test connection:** `redis-cli -a PASSWORD ping`
4. **Restart:** `systemctl restart redis-server`

---

## 📝 Changelog

### 2025-01-17
- ✅ Initial release
- ✅ Setup script dengan auto-configuration
- ✅ Monitor script dengan real-time stats
- ✅ Backup & restore automation
- ✅ Production-ready security settings
