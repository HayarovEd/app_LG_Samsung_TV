import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const iptvProxy = {
  target: 'http://iptv.teletvperm.ru:9981',
  changeOrigin: true,
}

const streamProxy = iptvProxy

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/iptv-api': {
        rewrite: (path) => path.replace(/^\/iptv-api/, ''),
        ...iptvProxy,
      },
      '/iptv-stream': {
        rewrite: (path) => path.replace(/^\/iptv-stream/, ''),
        ...streamProxy,
      },
      '/iptv-hls': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/iptv-hls/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/iptv-api': {
        rewrite: (path) => path.replace(/^\/iptv-api/, ''),
        ...iptvProxy,
      },
      '/iptv-stream': {
        rewrite: (path) => path.replace(/^\/iptv-stream/, ''),
        ...streamProxy,
      },
      '/iptv-hls': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/iptv-hls/, ''),
      },
    },
  },
})
