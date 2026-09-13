import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import WindiCSS from 'vite-plugin-windicss'
export default defineConfig({ plugins: [react(), WindiCSS()], server: { port: 5173, strictPort: true }, preview: { port: 4173, strictPort: true }, build: { chunkSizeWarningLimit: 1600 } })
