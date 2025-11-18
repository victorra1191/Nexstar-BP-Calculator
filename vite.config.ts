import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Safely define process.env.API_KEY as a string (empty if missing) to prevent runtime crashes
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    // Polyfill global process.env to prevent "process is not defined" errors from other libraries
    'process.env': {}
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) {
              return 'react-vendor';
            }
            if (id.includes('pdfjs-dist') || id.includes('jspdf') || id.includes('html2canvas')) {
              return 'pdf-libs';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});