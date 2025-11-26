
/// <reference types="node" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { firebaseConfig } from './services/firebaseConfig'; // Import your Firebase config

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Prioritize Vercel env var, fallback to firebaseConfig.apiKey if VITE_API_KEY is not set.
  // This ensures there's always an API key available, even if Vercel env is not fully configured.
  const apiKeyToInject = env.VITE_API_KEY || firebaseConfig.apiKey;

  return {
    plugins: [react()],
    define: {
      // Injects the API Key directly into the client-side code as a string literal.
      // This maps VITE_API_KEY (from Vercel) or the fallback directly to process.env.API_KEY.
      'process.env.API_KEY': JSON.stringify(apiKeyToInject)
    },
    build: {
      chunkSizeWarningLimit: 1600
    }
  };
});