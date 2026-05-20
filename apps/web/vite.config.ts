import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/leaderboard': 'http://localhost:8080',
      '/score': 'http://localhost:8080',
      '/game-start': 'http://localhost:8080',
    },
  },
});
