import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { i18n } from './i18n.js';
import router from './router.js';
import { logStorageUsage } from './storage/storage-utils.js';

const app = createApp(App);

// Global error handler — logs in dev, shows fallback in production.
app.config.errorHandler = (err, instance, info) => {
	if (import.meta.env.DEV) {
		console.error('[Vue Error]', err, info);
	}
	// You can extend this with a global toast / error-banner store later.
};

window.addEventListener('unhandledrejection', (event) => {
	if (import.meta.env.DEV) {
		console.error('[Unhandled Promise Rejection]', event.reason);
	}
	// Prevent noisy browser-level error overlays for handled fallback states.
	event.preventDefault();
});

app.use(i18n);
app.use(router).mount('#app');

// Log localStorage usage breakdown in dev mode.
logStorageUsage();
