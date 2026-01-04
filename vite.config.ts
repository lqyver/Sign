import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0', // 允许外网访问
    port: 1111,
    cors: true, // 启用 CORS
    allowedHosts: ['unconsumptive-existentialistically-alvaro.ngrok-free.dev', '.ngrok-free.dev', 'localhost'], // 明确指定允许的域名
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  },
})
