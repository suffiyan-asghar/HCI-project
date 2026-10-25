import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, API calls go to the study server (npm run server) on port 3000.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
