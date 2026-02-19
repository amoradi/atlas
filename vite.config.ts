import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    dts({ include: ['src'] })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Atlas',
      fileName: 'atlas'
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    }
  }
})
