import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('/node_modules/element-plus/')) {
            return 'vendor-element-plus'
          }
          if (id.includes('/node_modules/@element-plus/icons-vue/')) {
            return 'vendor-element-icons'
          }
          if (id.includes('/node_modules/vue/') || id.includes('/node_modules/vue-router/') || id.includes('/node_modules/pinia/')) {
            return 'vendor-vue'
          }
          if (id.includes('/node_modules/axios/')) {
            return 'vendor-axios'
          }
          return 'vendor'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 9529,
    host: '127.0.0.1',
  },
})
