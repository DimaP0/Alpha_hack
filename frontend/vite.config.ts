import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [react()], server: { host: '0.0.0.0', port: 5173, strictPort: true, proxy: { '/api': { target: env.BACKEND_URL || 'http://backend:8080', changeOrigin: true } } }, test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', css: false, maxWorkers: 1, minWorkers: 1, testTimeout: 30000 } };
});
