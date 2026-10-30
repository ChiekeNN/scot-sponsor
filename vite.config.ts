import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', allowedHosts: true, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/private-data/**', '**/scotsponsor-private/**', '**/Scotland_Licensed_Sponsors_Directory.csv'] } },
  preview: { host: '0.0.0.0', allowedHosts: true },
});
