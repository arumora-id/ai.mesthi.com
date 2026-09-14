# Deployment frontend tanpa demo

Konfigurasi ini ditujukan untuk domain `ai.mesthi.com`, API `api.mesthi.com`, dan nginx HTTPS yang sudah dimiliki. Tidak ada deployment, perubahan DNS, atau eksekusi task produksi yang dilakukan oleh PR ini.

## 1. Prasyarat autentikasi

Siapkan OIDC issuer dan confidential client dengan redirect URI persis:

```text
https://ai.mesthi.com/oauth2/callback
```

Access token dari issuer tersebut harus diterima oleh API C4. Cocokkan issuer/JWKS, audience, subject, tenant membership, role, expiry, dan provisioning dengan kode runtime API. OpenAPI saja tidak memberikan konfigurasi ini. Bila belum cocok, selesaikan integrasi identitas backend terlebih dahulu.

OAuth2 Proxy melakukan login, refresh, dan validasi sesi; token disimpan pada sesi Redis. Frontend hanya memakai cookie Secure + HttpOnly + SameSite=Lax dengan prefix \_\_Host-. Penggantian cookie saat refresh diteruskan oleh nginx. Sign-out menghapus sesi aplikasi; logout global dari identity provider adalah kebijakan IdP yang terpisah.

Referensi konfigurasi: [OAuth2 Proxy nginx integration](https://oauth2-proxy.github.io/oauth2-proxy/7.12.x/configuration/integration/), [OAuth2 Proxy options](https://oauth2-proxy.github.io/oauth2-proxy/7.12.x/configuration/overview/). Gunakan release yang disetujui dan digest immutable; uji opsi konfigurasi dengan release yang dipilih.

## 2. Build image

```sh
npm ci
npm run format:check
npm test
npm run build
npm run verify:bundle
docker build -t mesthi-frontend:0.2.0 .
```

Publikasikan image ke registry milik Anda lalu isi digest hasil publikasi di `MESTHI_FRONTEND_IMAGE`. Build tidak membutuhkan secret. Konteks Docker mengecualikan file environment dan direktori secret.

## 3. Konfigurasi server

```sh
mkdir -p deploy/secrets
chmod 700 deploy/secrets
cp deploy/production.env.example deploy/production.env
cp deploy/oauth2-proxy.cfg.example deploy/secrets/oauth2-proxy.cfg
cp deploy/redis.conf.example deploy/secrets/redis.conf
```

Isi file secara lokal di server atau melalui secret manager. Jangan kirim secret ke chat atau commit ke Git. Konfigurasi berisi client secret, random cookie key 32 byte, dan password Redis acak minimal 32 karakter. Password Redis harus sama pada kedua file.

Compose memasang file sebagai secret read-only pada container non-root. Untuk file-based Compose secrets, gunakan direktori host `deploy/secrets` mode 0700 dan file di dalamnya mode 0444, agar container dapat membacanya sementara akses host dibatasi oleh direktori induk. Jangan memindahkan file tersebut ke direktori publik. Untuk K3s gunakan Kubernetes Secret/secret manager dengan izin volume dan ServiceAccount yang sesuai.

```sh
chmod 444 deploy/secrets/oauth2-proxy.cfg deploy/secrets/redis.conf
npm run check:deployment
docker compose --env-file deploy/production.env -f deploy/compose.yaml config --quiet
```

Nilai `MESTHI_EDGE_NETWORK` harus merupakan network Docker yang sudah terhubung ke container nginx HTTPS. Pasang blok [edge nginx](../deploy/edge-nginx.conf.example) di server HTTPS `ai.mesthi.com`. Domain dan sertifikat harus valid. Port internal 8080 dan layanan auth/Redis tidak perlu dipublikasikan ke internet.

## 4. Mulai setelah konfigurasi lolos

```sh
docker compose --env-file deploy/production.env -f deploy/compose.yaml up -d
docker compose --env-file deploy/production.env -f deploy/compose.yaml ps
```

Gateway memverifikasi sertifikat TLS upstream `api.mesthi.com`; jangan menonaktifkan `proxy_ssl_verify`. File statis ber-hash dapat di-cache, index/API/auth memakai no-store. POST/PATCH/DELETE membutuhkan Origin yang persis sama dan header aplikasi; browser tidak dapat mengganti bearer atau identity header backend.

Redis hanya menyimpan sesi autentikasi, memakai password, private network, batas memori, dan tanpa persistence. Restart Redis membuat pengguna perlu login kembali. Untuk kebutuhan availability lebih tinggi gunakan Redis HA dengan TLS dan sesuaikan konfigurasi yang diuji. Data bisnis tetap di backend PostgreSQL, bukan Redis ini.

## 5. Acceptance dan rollback

Jalankan daftar verifikasi di [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). Read-only smoke script memakai `MESTHI_SMOKE_TOKEN` melalui environment dan `--workspace` UUID yang memang diizinkan; script tidak mencetak token atau isi respons.

```sh
python3 scripts/smoke_api.py --base https://api.mesthi.com --workspace YOUR_WORKSPACE_UUID
```

Sebelum membuka akses publik, uji login dua tenant, session expiry, satu task nyata dengan agent/model yang sudah dikonfigurasi, cancellation, dan hasil delivery. Tes CI menggunakan server uji, bukan backend deployment Anda.

Simpan digest image sebelumnya. Rollback frontend dilakukan dengan mengembalikan `MESTHI_FRONTEND_IMAGE` ke digest tersebut dan menjalankan ulang Compose. Jangan rollback ke versi demo untuk penggunaan publik. Rollback frontend tidak membatalkan task atau menghapus data yang sudah dibuat di backend.

Integrasikan log gateway dan API ke observability yang sudah ada. Korelasikan X-Request-ID; jangan mengaktifkan log token, cookie, prompt, atau payload dokumen. Pantau kegagalan login, 401/403, 5xx, waktu respons, dan kegagalan eksekusi/delivery.
