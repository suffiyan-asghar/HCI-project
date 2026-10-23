import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host: true exposes the dev server on the LAN so the study laptops can reach it.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
});
