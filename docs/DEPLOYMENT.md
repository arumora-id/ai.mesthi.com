# Deployment

Aplikasi menghasilkan berkas statis di `dist/` melalui `npm run build`. Deploy direktori itu ke hosting statis atau reverse proxy untuk ai.mesthi.com. Tidak ada deployment, perubahan DNS, TLS, atau produksi otomatis dalam repository ini.

## Demo

Gunakan `VITE_DATA_MODE=demo` saat build. Semua perubahan demo berada di browser pengguna. Clear site data akan menghapusnya.

## C4 API

Gunakan `VITE_DATA_MODE=api` dan `VITE_API_BASE_URL=/api` saat build. Contoh blok Nginx untuk dimasukkan ke server HTTPS yang sudah dikonfigurasi:

```nginx
root /srv/ai.mesthi.com/dist;
index index.html;

location / {
    try_files $uri $uri/ /index.html;
}

location /api/ {
    proxy_pass https://api.mesthi.com/;
    proxy_ssl_server_name on;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_set_header Host api.mesthi.com;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    add_header Cache-Control "no-store" always;
}
```

Sesuaikan alamat upstream dan trust store dengan lingkungan Anda. `proxy_pass` berakhiran slash menghapus prefiks /api sehingga /api/v1/workspaces diteruskan sebagai /v1/workspaces. Jangan arahkan /api ke fallback index.html.

Session/login produksi perlu integrasi identity gateway. Settings menyediakan token memori untuk validasi integrasi awal saja.

## Validasi sebelum rilis

CI memeriksa TypeScript, build Windi/Vite, domain dan kontrak API, lalu interaksi browser serta screenshot desktop/mobile. API tests memakai respons mock sesuai kontrak; tidak mengeksekusi workload pada backend produksi. Uji integrasi dengan token tenant uji dan konfigurasi gateway Anda tetap diperlukan sebelum peluncuran API mode.
