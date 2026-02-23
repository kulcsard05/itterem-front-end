import { createRouter, createWebHistory } from 'vue-router';
import MenuView from './components/MenuView.vue';
import MenuItemPage from './components/MenuItemPage.vue';
import UserPage from './components/UserPage.vue';
import AdminDashboard from './components/AdminDashboard.vue';
import NotFound from './components/NotFound.vue';
import AboutUs from './components/AboutUs.vue';
import { readStoredAuth } from './utils.js';

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
		path: '/about',
		name: 'about',
		component: AboutUs,
	},
	{
		path: '/admin',
		name: 'admin',
		component: AdminDashboard,
		beforeEnter: () => {
			const auth = readStoredAuth();
			if (auth && auth.token && Number(auth.jogosultsag) === 3) return true;
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
