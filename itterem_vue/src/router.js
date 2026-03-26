import { createRouter, createWebHistory } from 'vue-router';
import { notifyPermissionDenied, readStoredAuth } from './shared/utils.js';
import {
	LOCALE_QUERY_KEY,
	ROLE_EMPLOYEE,
	ROLE_ADMIN,
} from './config/constants.js';
import { normalizeLocale } from './i18n.js';
import { resolveLocalePreference, setLocale } from './composables/useLocale.js';

const MenuView = () => import('./components/public/MenuView.vue');
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
	scrollBehavior(_to, _from, savedPosition) {
		if (savedPosition) return savedPosition;
		return { top: 0 };
	},
});

function notifyRouteDenied({ messageKey, to, requiredRole = null, currentRole = null, hasToken = false }) {
	notifyPermissionDenied({
		messageKey,
		source: 'router',
		scope: 'route',
		hasToken,
		requiredRole,
		currentRole,
		attemptedRoute: String(to?.name ?? to?.path ?? ''),
	});
}

// Employees (jogosultsag=2) should only see the order management page.
router.beforeEach((to, from) => {
	const rawLang = Array.isArray(to.query?.[LOCALE_QUERY_KEY]) ? to.query?.[LOCALE_QUERY_KEY]?.[0] : to.query?.[LOCALE_QUERY_KEY];
	const normalizedLang = normalizeLocale(rawLang);
	if (rawLang != null && !normalizedLang) {
		return {
			name: to.name,
			params: to.params,
			query: {
				...to.query,
				[LOCALE_QUERY_KEY]: resolveLocalePreference(),
			},
			hash: to.hash,
			replace: true,
		};
	}

	setLocale(normalizedLang ?? resolveLocalePreference(), { persist: normalizedLang != null });

	const auth = readStoredAuth();
	const hasToken = Boolean(auth?.token);
	const role = Number(auth?.jogosultsag);
	const isEmployee = hasToken && role === ROLE_EMPLOYEE;

	const requiredRole = Number(to.meta?.requiredRole ?? NaN);
	if (Number.isFinite(requiredRole)) {
		if (!hasToken) {
			notifyRouteDenied({
				messageKey: 'errors.signInRequiredRoute',
				to,
				requiredRole,
				currentRole: role,
				hasToken,
			});
			return { name: 'menu' };
		}
		if (role !== requiredRole) {
			notifyRouteDenied({
				messageKey: 'errors.permissionDeniedRoute',
				to,
				requiredRole,
				currentRole: role,
				hasToken,
			});
			if (isEmployee) return { name: 'employee-orders' };
			return { name: 'menu' };
		}
	}

	if (!isEmployee) return true;
	if (to.name === 'employee-orders') return true;
	if (from?.name) {
		notifyRouteDenied({
			messageKey: 'errors.permissionDeniedRoute',
			to,
			requiredRole: ROLE_EMPLOYEE,
			currentRole: role,
			hasToken,
		});
	}
	return { name: 'employee-orders' };
});

export default router;
