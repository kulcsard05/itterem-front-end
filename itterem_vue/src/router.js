import { createRouter, createWebHistory } from 'vue-router';
import MenuView from './components/public/MenuView.vue';
import { readStoredAuth } from './utils.js';
import { ROLE_EMPLOYEE, ROLE_ADMIN } from './constants.js';

const MenuItemPage = () => import('./components/public/MenuItemPage.vue');
const UserPage = () => import('./components/user/UserPage.vue');
const AdminDashboard = () => import('./components/admin/AdminDashboard.vue');
const EmployeeOrders = () => import('./components/admin/EmployeeOrders.vue');
const NotFound = () => import('./components/public/NotFound.vue');
const AboutUs = () => import('./components/public/AboutUs.vue');

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
		meta: { requiredRole: ROLE_ADMIN },
	},
	{
		path: '/rendeleskezeles',
		name: 'employee-orders',
		component: EmployeeOrders,
		meta: { requiredRole: ROLE_EMPLOYEE },
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
	const hasToken = Boolean(auth?.token);
	const role = Number(auth?.jogosultsag);
	const isEmployee = hasToken && role === ROLE_EMPLOYEE;

	const requiredRole = Number(to.meta?.requiredRole ?? NaN);
	if (Number.isFinite(requiredRole)) {
		if (!hasToken) return { name: 'menu' };
		if (role !== requiredRole) {
			if (isEmployee) return { name: 'employee-orders' };
			return { name: 'menu' };
		}
	}

	if (!isEmployee) return true;
	if (to.name === 'employee-orders') return true;
	return { name: 'employee-orders' };
});

export default router;
