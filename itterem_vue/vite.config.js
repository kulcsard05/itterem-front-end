import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	// Precedence: launcher-provided process env > .env file > local default.
	const apiTarget = process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL || 'http://localhost:7200' ;

	return {
		plugins: [vue()],
		server: {
			allowedHosts: ['unexpressable-baylee-sagaciously.ngrok-free.dev'],
			proxy: {

				'/api': {
					target: apiTarget,
					changeOrigin: true,
				},
				'/orderHub': {
					target: apiTarget,
					changeOrigin: true,
					ws: true,
				},
			},
		},
	};
});
