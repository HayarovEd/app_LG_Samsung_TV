import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/iptv-api': {
        target: 'http://iptv.teletvperm.ru:9981',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/iptv-api/, ''),
      },
    },
  },
})
