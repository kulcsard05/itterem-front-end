import { createRouter, createWebHistory } from 'vue-router';
import MenuView from './components/MenuView.vue';
import MenuItemPage from './components/MenuItemPage.vue';
import UserPage from './components/UserPage.vue';
import AdminDashboard from './components/AdminDashboard.vue';
import EmployeeOrders from './components/EmployeeOrders.vue';
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
			return auth?.token && Number(auth.jogosultsag) === 3 ? true : { name: 'menu' };
		},
	},
	{
		path: '/rendeleskezeles',
		name: 'employee-orders',
		component: EmployeeOrders,
		beforeEnter: () => {
			const auth = readStoredAuth();
			return auth?.token && Number(auth.jogosultsag) === 2
				? true
				: { name: 'menu' };
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

// Employees (jogosultsag=2) should only see the order management page.
router.beforeEach((to) => {
	const auth = readStoredAuth();
	const isEmployee = Boolean(auth?.token) && Number(auth?.jogosultsag) === 2;
	if (!isEmployee) return true;
	if (to.name === 'employee-orders') return true;
	return { name: 'employee-orders' };
});

export default router;
