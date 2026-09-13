# MESTHI · AI workspace

Frontend untuk workspace AI: Mission Control, workforce packs, task execution, dan kantor interaktif. React + Vite + TypeScript + Windi CSS, GSAP untuk animasi antarmuka, dan Phaser untuk Live Office.

## Jalankan

Gunakan Node.js 24 (minimum 22.12).

```sh
npm install
cp .env.example .env.local
npm run dev
```

Mode awal adalah **demo**. Data disimpan di browser dan dibatasi per workspace. Simulasi tidak memanggil model, merender video, memublikasikan konten, menghubungkan akun, atau melakukan pembayaran.

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

CI menjalankan build produksi, pengujian domain/API, dan pengujian browser Chromium. Setelah validasi push branch fitur berhasil, CI menyimpan lockfile dan tangkapan layar pada branch yang sama. Gunakan `npm ci` setelah lockfile tersedia.

## Yang tersedia

- Mission Control, daftar/board task, detail aktivitas dan status delivery.
- Workspace terpisah; Content Studio, Software Team, Research Team, atau workspace kosong.
- Agent, konfigurasi demo, custom markdown skills, reference documents, dan preview/download outputs.
- Workflow templates, anggaran dan reservasi kredit demo, approval manusia, serta pause/resume/cancel.
- Content Studio untuk menyusun brief dan storyboard; output contoh ditandai sebagai demo.
- Kantor Phaser dengan karakter pixel, objek interaktif, pathfinding, dan roster yang dapat diakses melalui keyboard.
- GSAP page entry, stagger kartu/daftar, scroll reveal, counters, dan modal. Reduced motion dihormati dan efek dibersihkan saat navigasi.
- Tampilan responsif, tema terang/gelap, pencarian Cmd/Ctrl K, serta dialog native dengan fokus dan Escape.

## Hubungkan ke C4

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api
```

Build ulang setelah mengganti variabel Vite. Atur reverse proxy **same origin** dari `/api` menuju control plane. Buka Settings untuk memasukkan bearer token sesi yang sudah diterbitkan oleh sistem autentikasi Anda. Token hanya disimpan dalam memori, hilang saat reload, dan tidak dimasukkan ke bundle maupun localStorage.

Mode API memulai state kosong dan hanya memakai endpoint C4 yang sudah diperiksa: workspace, agent, task, queue/start/cancel, dan entitlements. Kegagalan API ditampilkan sebagai error; tidak digantikan oleh data demo.

Autentikasi login/refresh produksi masih memerlukan integrasi identity gateway. Token manual adalah fasilitas integrasi awal untuk operator yang berwenang.

## Arsitektur dan batas integrasi

[Keselarasan C4](docs/C4_ALIGNMENT.md) memetakan konsep produk ke batas runtime yang sudah ada. [Kontrak API](docs/API_CONTRACT.md) menjelaskan endpoint yang digunakan dan fitur yang memerlukan ekstensi backend. [Deployment](docs/DEPLOYMENT.md) menjelaskan hosting statis dan reverse proxy.

Frontend ini tidak menjalankan Hermes, gVisor, Git Broker, Git Finalizer, atau scheduler. Live Office memvisualisasikan state; pergerakan karakter tidak memulai atau menyelesaikan task. Worktree tetap detail eksekusi untuk pekerjaan kode.

Sumber implementasi adalah arsip konsep produk yang tersedia, README arsitektur backend, dan OpenAPI canonical pada commit [09fcaccc](https://github.com/arumora-id/api.mesthi.com/tree/09fcaccc449d09456026de90dc2665ddcb5e32ce). Tautan percakapan ChatGPT privat tidak dapat dibaca seluruhnya secara langsung; dokumentasi ini tidak mengklaim audit lengkap atas kedua percakapan.

## Status produk

Ini adalah MVP frontend dengan demo yang dapat digunakan dan adapter C4 terbatas pada kontrak terverifikasi. General approval/publishing, provider video/audio/image, OAuth/MCP, server-side skills, atomic pack installation, generic artifact storage, scheduler, dan metering baru memerlukan pekerjaan backend.

Free/Pro dan angka harga yang tampil adalah proposal produk. Tidak ada checkout atau penagihan aktif. Preferensi jadwal demo tidak menjalankan pekerjaan di latar belakang.

Windi CSS digunakan sesuai permintaan. Karena proyek upstream berada dalam masa sunsetting, dependensinya dipin dan kompatibilitas build diperiksa di CI; migrasi CSS di masa depan adalah keputusan terpisah.
