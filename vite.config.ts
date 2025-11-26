
/// <reference types="node" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // The third parameter is the prefix that will be exposed in the client code.
  // We specify '' to load all env vars, then explicitly define `process.env.API_KEY`.
  const env = loadEnv(mode, process.cwd(), '');

  // Your specific Firebase/Google key. This acts as a robust fallback.
  // This key should ideally be managed via Vercel env vars as VITE_API_KEY
  const FALLBACK_API_KEY = "AIzaSyBBPymwl4qc4KPUZRBD0dVaXQ5n6iDj48c"; // Ensure this is your latest, working key

  const apiKeyToInject = env.VITE_API_KEY || FALLBACK_API_KEY;

  return {
    plugins: [react()],
    define: {
      // Injects the API Key directly into the client-side code string.
      // This is the standard way to expose env vars starting with VITE_ to process.env in Vite.
      'process.env.API_KEY': JSON.stringify(apiKeyToInject)
    },
    build: {
      chunkSizeWarningLimit: 1600
    }
  };
});