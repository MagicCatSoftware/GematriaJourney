import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,         // listen on LAN/0.0.0.0 (fixes some Windows envs)
    port: 5173,
    strictPort: true,   // fail clearly if 5173 is busy
    open: true          // auto-open browser
  }
});