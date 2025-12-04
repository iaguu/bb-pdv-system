import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: './',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    host: 'localhost',   // ou true, mas localhost já é ok
    port: 5173,          // fixa na mesma porta que o Electron usa
    strictPort: true,    // se 5173 estiver ocupada, Vite dá erro em vez de mudar
  },
  build: {
    outDir: 'dist'
  }
});
