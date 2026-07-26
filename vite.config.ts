import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000
      },
      manifest: {
        name: 'Smart Market - نظام المبيعات والكاشير',
        short_name: 'Smart Market',
        description: 'نظام كاشير ومبيعات ومخازن ذكي يعمل بدون إنترنت',
        theme_color: '#4f46e5',
        background_color: '#1f2028',
        start_url: '/',
        scope: '/',
        id: '/',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
