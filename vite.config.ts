import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Injects the VITE_API_KEY from Vercel (or local .env) into process.env.API_KEY
      // This is necessary because the app expects process.env.API_KEY, but Vite/Vercel uses VITE_ prefixes.
      'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY || env.VITE_API_KEY || '')
    },
    build: {
      chunkSizeWarningLimit: 1600
    }
  };
});