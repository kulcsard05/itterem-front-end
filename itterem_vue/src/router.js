import { createRouter, createWebHistory } from 'vue-router';
import MenuView from './components/MenuView.vue';
import MenuItemPage from './components/MenuItemPage.vue';
import UserPage from './components/UserPage.vue';
import AdminDashboard from './components/AdminDashboard.vue';
import NotFound from './components/NotFound.vue';

const routes = [
	{
		path: '/',
		name: 'menu',
		component: MenuView,
	},
	{
		path: '/item',
		name: 'menu-item',
		component: MenuItemPage,
	},
	{
		path: '/account',
		name: 'account',
		component: UserPage,
	},
	{
		path: '/admin',
		name: 'admin',
		component: AdminDashboard,
		beforeEnter: () => {
			try {
				const raw = localStorage.getItem('auth');
				const auth = raw ? JSON.parse(raw) : null;
				if (auth && auth.token && Number(auth.jogosultsag) === 3) return true;
			} catch {
				// fall through
			}
			return { name: 'menu' };
		},
	},
	{
		path: '/:pathMatch(.*)*',
		name: 'not-found',
		component: NotFound,
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

export default router;
