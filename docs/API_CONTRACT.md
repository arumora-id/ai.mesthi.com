# Kontrak frontend–C4

Adapter: `src/core/c4Adapter.ts`. DTO respons divalidasi dengan Zod. Canonical source: [OpenAPI 09fcaccc](https://github.com/arumora-id/api.mesthi.com/blob/09fcaccc449d09456026de90dc2665ddcb5e32ce/openapi/openapi.json).

## Endpoint yang digunakan

| Method | Path | Kegunaan |
| --- | --- | --- |
| GET | /v1/workspaces | Workspace yang diizinkan |
| POST | /v1/workspaces | Workspace kosong; tidak mengklaim instalasi pack |
| GET | /v1/workspaces/{workspace_id}/agents | Agent dalam workspace |
| POST | /v1/workspaces/{workspace_id}/agents | name, role, model_source=mesthi_ai |
| GET | /v1/workspaces/{workspace_id}/tasks | TaskRead untuk monitor |
| POST | /v1/workspaces/{workspace_id}/tasks | agent_id, title, instructions, priority=normal |
| POST | /v1/workspaces/{workspace_id}/tasks/{task_id}/queue | Queue eksplisit |
| POST | /v1/workspaces/{workspace_id}/tasks/{task_id}/start | Start eksplisit |
| POST | /v1/workspaces/{workspace_id}/tasks/{task_id}/cancel | Cancel eksplisit |
| GET | /v1/workspaces/{workspace_id}/entitlements | Plan, limits, subscription, credits.available |

API polling hanya saat tab terlihat dan token tersedia, setiap 15 detik. Setiap request memiliki timeout 15 detik. Refresh yang sudah usang diabaikan setelah request/mutasi baru. Perintah mutasi tidak diulang otomatis. Jika perintah diterima tetapi refresh gagal, UI meminta refresh sebelum pengulangan.

Setiap daftar agent/task diperiksa kecocokan workspace_id. Validasi frontend tidak menggantikan otorisasi tenant di backend.

## Data yang tidak disimpulkan

- Persentase progres TaskRead tidak tersedia; UI menampilkan tanda em dash kecuali completed.
- TaskSession ID dan bukti delivery tidak tersedia pada TaskRead.
- Endpoint `POST .../sessions/{task_session_id}/reconcile` ada, tetapi tidak digunakan tanpa sumber task_session_id yang sah.
- `/v1/sessions` bukan pengganti otomatis TaskSession.
- Tidak ada endpoint snapshot/command gabungan yang dibuat-buat.
- Tidak ada fallback ke demo ketika sesi API gagal.
- Available credits berasal dari entitlements, bukan penghitungan meter lokal.
- Policy `draft_only` pada view model bukan klaim bahwa backend menerapkan policy produk tersebut. Kontrolnya dinonaktifkan di mode API.

## Autentikasi

Untuk integrasi awal, bearer token sesi resmi dimasukkan lewat Settings, disimpan hanya dalam memori, dan dikirim ke origin yang sama. HTTP 401 menghapus token memori; HTTP 403 ditampilkan sebagai penolakan izin. Token/credential tidak boleh ditempatkan di variabel `VITE_*`, source, screenshot, atau localStorage.

Reverse proxy perlu mempertahankan Authorization dan menerapkan TLS, otorisasi, serta kebijakan CORS/CSRF sesuai gateway produksi. Adapter memakai `credentials: omit` dan `cache: no-store`.

## Fitur yang perlu endpoint baru

Atomic pack installation; agent skill binding/versioning; custom avatars persisten; workflow schedules; knowledge/skills; artifact content/download; generic content approval/publishing; OAuth/MCP configuration; provider media jobs; budget mutation dan metering tambahan. UI demo untuk fitur-fitur itu tidak memanggil endpoint spekulatif.
