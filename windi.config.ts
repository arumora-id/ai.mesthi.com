import { defineConfig } from 'vite-plugin-windicss'
export default defineConfig({ darkMode: 'class', preflight: false, extract: { include: ['src/**/*.{tsx,ts}', 'index.html'] }, theme: { extend: { colors: { mint: '#c5f277', ink: '#17231e' } } }, shortcuts: { row: 'flex items-center', 'row-between': 'flex items-center justify-between', stack: 'flex flex-col' } })
