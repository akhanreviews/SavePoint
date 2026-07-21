import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    rollupOptions: {
      input: ['index.html', 'top-10/index.html'],
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
  },
});
