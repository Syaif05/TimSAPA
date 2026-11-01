import { defineConfig, loadEnv } from 'vite'
import { createApplicationApi, nodeApiHandler } from './server/applicationApi.js'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.sapa-cache/**'] } },
  plugins: [
    { name: 'sapa-server-api', configureServer(server) { const handler = nodeApiHandler(createApplicationApi({ env: { ...process.env, ...loadEnv(mode, process.cwd(), '') } })); server.middlewares.use((req, res, next) => req.url?.startsWith('/api/') ? handler(req, res) : next()) }, configurePreviewServer(server) { const handler = nodeApiHandler(createApplicationApi({ env: { ...process.env, ...loadEnv(mode, process.cwd(), '') } })); server.middlewares.use((req, res, next) => req.url?.startsWith('/api/') ? handler(req, res) : next()) } },
    react(),
    tailwindcss(),
  ],
}))
