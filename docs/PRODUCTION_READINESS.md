# Kesiapan produksi dan konfigurasi yang diperlukan

## Status yang bisa dipastikan dari PR ini

Mesin demo, seeded data, tick execution, fake approval, fake credits, local files, dan pilihan mode demo sudah dihapus. Aplikasi memakai API nyata untuk seluruh operasi bisnis yang ditampilkan. Fixture pengujian hanya ada di tests dan tidak masuk build.

Frontend dan gateway telah disiapkan untuk deployment terkonfigurasi. **Keseluruhan produk belum dapat dinyatakan production-ready end-to-end** sampai autentikasi, otorisasi tenant, infrastruktur, dan task delivery diuji pada lingkungan nyata. Fitur tambahan memerlukan implementasi backend, bukan sekadar pengisian environment.

Repository `arumora-id/api.mesthi.com` saat diperiksa adalah dokumentasi/OpenAPI, bukan source runtime `mesthi-api`. Source runtime diperlukan untuk menambahkan layanan storage, skills, scheduler, approval, dan publishing.

## Informasi yang perlu diberikan tanpa secret

| Area             | Informasi/configuration yang diperlukan                                                                             | Tempat konfigurasi                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Runtime API      | Repository source runtime mesthi-api; image/versi yang benar-benar berjalan; URL staging                            | Backend/K3s                        |
| Identity         | OIDC issuer, client ID, audience yang diterima API, mapping subject/tenant/role, aturan provisioning pengguna       | IdP, API, OAuth2 Proxy             |
| Domain           | DNS/TLS untuk ai.mesthi.com dan api.mesthi.com; network container nginx HTTPS yang aktif                            | DNS dan nginx                      |
| Gateway          | Digest image frontend, OAuth2 Proxy, Redis; nama network nginx                                                      | deploy/production.env              |
| Model/runtime    | Model ID yang valid, default OmniRoute route, provider/BYOK yang sudah diprovision, kesiapan Hermes/Sandbox Manager | Backend/runtime                    |
| Code delivery    | GitHub App installation/repository permission, Git Broker dan Git Finalizer yang sehat                              | Backend/K3s                        |
| Object storage   | Penyedia/endpoint S3-compatible, bucket privat, region, prefix/retention dan batas ukuran file                      | Backend artifact service           |
| RAG              | Endpoint Qdrant dan model embedding/dimensi; kebijakan akses per tenant/workspace                                   | Backend ingestion/indexing worker  |
| Media/publishing | Provider generation yang dipilih; akun/channel dan OAuth scopes yang telah disetujui                                | Provider adapter/connector service |
| Billing          | Provider pembayaran, price/product IDs, webhook URL dan aturan penggunaan/ledger                                    | Backend billing service            |

Client secret, signing key, provider token, OAuth refresh token, database password, S3 key, dan webhook secret harus dimasukkan melalui secret manager/Kubernetes Secret/server-local secret file. Jangan masukkan ke `VITE_*`, localStorage, repository, atau pesan chat.

## Kebutuhan object storage yang konkret

Mesthi Object Storage menjadi authority untuk berkas pengguna dan hasil agent. PostgreSQL menyimpan metadata dan kepemilikan; blob disimpan di S3-compatible storage; Qdrant menjadi indeks pencarian turunan. GitHub tetap untuk source-code delivery; Google Drive/GitHub connector tidak menggantikan artifact library internal.

Usulan nama konfigurasi server berikut belum berarti backend saat ini sudah membacanya:

```dotenv
S3_ENDPOINT=https://YOUR_STORAGE_ENDPOINT
S3_BUCKET=mesthi-artifacts
S3_REGION=YOUR_REGION
S3_ACCESS_KEY=SERVER_SECRET_REFERENCE
S3_SECRET_KEY=SERVER_SECRET_REFERENCE
S3_FORCE_PATH_STYLE=false
ARTIFACT_MAX_UPLOAD_BYTES=YOUR_APPROVED_LIMIT
ARTIFACT_UPLOAD_URL_TTL_SECONDS=300
QDRANT_URL=https://YOUR_QDRANT_ENDPOINT
QDRANT_API_KEY=SERVER_SECRET_REFERENCE
EMBEDDING_MODEL_ID=YOUR_CONFIGURED_MODEL
```

Jangan menaruh MinIO/data blob pada root disk VPS yang kapasitasnya sedang terbatas. Gunakan kapasitas storage terpisah atau layanan S3-compatible yang dipilih, dengan backup/lifecycle yang jelas.

Alur implementasi yang diperlukan:

1. API memverifikasi membership dan kuota, membuat metadata upload pending serta object key yang ditentukan server dalam scope tenant/workspace.
2. API memberikan signed upload URL berdurasi pendek, terikat object key/metode. Browser tidak menerima access key storage.
3. Upload difinalisasi di API setelah ukuran/checksum/content type diverifikasi; objek belum boleh dipakai agent sebelum pemeriksaan konten selesai.
4. Worker melakukan parsing, scanning yang sesuai, embedding, dan upsert indeks dengan filter tenant/workspace. Indeks tidak menjadi sumber otorisasi.
5. Listing/download memakai pemeriksaan izin backend dan signed GET URL singkat; deletion/tombstone menghapus blob dan indeks secara konsisten.
6. Generated artifact diikat ke task dan TaskSession yang sah, menyertakan versi/provenance agar approval dan publishing memeriksa hasil yang sama.

Bucket harus privat. Bila browser upload langsung ke storage, CORS dibatasi ke `https://ai.mesthi.com`, metode upload yang digunakan, dan header yang diperlukan. Konfigurasi CSP frontend baru diperluas ke hostname storage yang tepat setelah endpoint/artifact workflow tersedia.

Tidak ada upload button yang mengaku berhasil menyimpan file pada release ini. Menyiapkan bucket saja tidak cukup; endpoint, metadata, ingestion worker, dan izin tersebut tetap harus diimplementasikan.

## Ekstensi backend yang belum tersedia dalam OpenAPI

| Fitur                        | Kontrak/layanan minimal yang perlu ditambahkan                               | Kriteria siap                                                   |
| ---------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Artifact & knowledge library | Initiate/finalize upload, list/read/delete artifact, authorized download     | Ownership, quota, content validation, retention, backup/restore |
| Skills & custom avatars      | Versioned skill registry/binding; avatar asset reference dan sprite metadata | Persistent server data, scope validation, policy review         |
| Workforce packs              | Versioned templates dan atomic/idempotent install transaction                | Tidak ada instalasi tim setengah jadi                           |
| Workflows/schedules          | Persisted workflow definition, timezone-aware scheduler, trigger/job history | Idempotent enqueue, retry policy, concurrency guard             |
| Human approval               | Versioned output + destination + action + approver record                    | Approval tidak berlaku untuk output yang berubah                |
| Media jobs                   | Provider submission, async status/webhook, generated artifact record         | Biaya/kuota, retry, cancellation, real output validation        |
| Publishing/OAuth/MCP         | Credential vault, OAuth callback, scopes, delivery adapter, audit            | Explicit authorized target, no duplicate external posts         |
| Billing                      | Payment checkout/portal, signed webhook, credit ledger, reconciliation       | Idempotent webhook, authoritative balances, negative-path tests |
| Task observability           | TaskSession reference, delivery evidence, safe event stream                  | UI tidak menebak session ID, progres, atau Git SHA              |
| Concurrent commands          | Idempotency keys dan optimistic concurrency/version check                    | Retry tidak menghasilkan eksekusi atau transaksi ganda          |

Ini adalah kebutuhan desain, bukan klaim adanya endpoint baru pada api.mesthi.com. Daftar endpoint yang benar-benar dipanggil frontend ada di [API_CONTRACT.md](API_CONTRACT.md).

## Gate sebelum penggunaan publik

- Konfigurasi deployment lolos checker; TLS/DNS/health checks berhasil; image produksi memakai digest immutable.
- Login OIDC berfungsi dan C4 menerima access token pengguna dengan issuer/audience yang benar.
- Dua akun tenant berbeda tidak dapat membaca atau mengubah workspace/agent/task satu sama lain, termasuk bila UUID ditukar langsung pada request.
- Logout dan expiry menutup akses API; UI membersihkan data; token tidak terlihat di bundle, storage browser, maupun log.
- Create/edit workspace dan agent bertahan setelah reload; model route, provider, repository permissions, dan budget enforcement benar-benar siap.
- Satu task nyata di-queue dan di-start: TaskSession, Hermes/sandbox, result summary, serta Git Finalizer/delivery diverifikasi di backend. UI completion saja bukan bukti Git push.
- Cancellation dan kegagalan provider/sandbox memberi status/error yang benar; request yang timeout tidak diulang otomatis.
- Backup/restore PostgreSQL dan, ketika ditambahkan, object storage telah diuji; observability dan rollback image berfungsi.

Script `scripts/smoke_api.py` hanya melakukan GET untuk memeriksa koneksi dan scope; tidak membuat task, tidak memakai model, dan tidak memublikasikan hasil. Test browser CI memakai fixture jaringan terisolasi; bukan bukti bahwa identitas atau backend produksi sudah terkonfigurasi.
