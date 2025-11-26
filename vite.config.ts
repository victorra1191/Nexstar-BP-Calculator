import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Fix: process.cwd() might trigger TS error if types are missing, casting to any.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // The fallback key is your specific Firebase/Google key provided in previous contexts.
  // This ensures that if Vercel's environment variable fails for any reason, the app still works.
  // Updated to new key ending in ...Dj48c
  const FALLBACK_KEY = "AIzaSyBBPymwl4qc4KPUZRBD0dVaXQ5n6iDj48c";
  
  const apiKeyToInject = process.env.VITE_API_KEY || env.VITE_API_KEY || FALLBACK_KEY;

  return {
    plugins: [react()],
    define: {
      // Injects the API Key directly into the client-side code string.
      'process.env.API_KEY': JSON.stringify(apiKeyToInject)
    },
    build: {
      chunkSizeWarningLimit: 1600
    }
  };
});