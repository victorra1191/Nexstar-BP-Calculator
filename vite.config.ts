import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Removed direct import of firebaseConfig here as its API key will now come from an env var.

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Injects separate API Keys for Firebase and Gemini.
      // These will map to environment variables set in Vercel.
      // No fallback to hardcoded keys here; if env vars aren't set, it will be undefined in the app.
      'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY),
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY)
    },
    build: {
      chunkSizeWarningLimit: 1600
    }
  };
});