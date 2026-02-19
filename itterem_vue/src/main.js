import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from './router.js';

const app = createApp(App);

// Global error handler — logs in dev, shows fallback in production.
app.config.errorHandler = (err, instance, info) => {
	if (import.meta.env.DEV) {
		console.error('[Vue Error]', err, info);
	}
	// You can extend this with a global toast / error-banner store later.
};

app.use(router);
app.mount('#app');
