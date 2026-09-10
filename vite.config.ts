import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/13f-tracker/',
  server: { host: '127.0.0.1', port: 8890, strictPort: true },
  preview: { host: '127.0.0.1', port: 8890, strictPort: true },
})
