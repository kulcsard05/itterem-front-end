<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import CartDrawer from './components/user/CartDrawer.vue';
import FooterSection from './components/public/FooterSection.vue';
import ConfirmModal from './components/admin/ConfirmModal.vue';
import { useCart } from './composables/useCart.js';
import { useAuth } from './composables/useAuth.js';
import { useLocale } from './composables/useLocale.js';
import { AUTH_EXPIRED_EVENT, LOCALE_QUERY_KEY, PERMISSION_DENIED_EVENT } from './config/constants.js';

const isDevServerDiscoveryEnabled = import.meta.env.DEV;
const ServerDiscovery = isDevServerDiscoveryEnabled
	? defineAsyncComponent(() => import('./components/ServerDiscovery.vue'))
	: null;

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const { currentLocale, supportedLocales, setLocale } = useLocale();

const {
	auth,
	isLoggedIn,
	isAdmin,
	isEmployee,
	setAuth,
	logout: doLogout,
	scheduleAuthExpiry,
	clearAuthExpiryTimer,
	handleStorageChange: onStorageChange,
	handleAuthExpired: onAuthExpired,
} = useAuth();

const selectedMenuItem = ref(null);
const cartOpen = ref(false);
const serverDiscoveryOpen = ref(false);
const serverReachable = ref(null);
const logoutConfirmOpen = ref(false);
const languageMenuOpen = ref(false);
const mobileLanguageMenuRef = ref(null);
const desktopLanguageMenuRef = ref(null);
const permissionDeniedMessage = ref('');

const PERMISSION_BANNER_TIMEOUT_MS = 5000;
const CART_HISTORY_STATE_KEY = 'itteremCartOpen';
let permissionBannerTimer = null;

const { addItem, totalItems } = useCart();

const localeOptions = computed(() =>
	supportedLocales.map((locale) => ({
		value: locale,
		label: t(`locales.${locale}`),
	})),
);

// Restore selected menu item from sessionStorage (survives page refresh).
try {
	const raw = sessionStorage.getItem('selectedMenuItem');
	if (raw) selectedMenuItem.value = JSON.parse(raw);
} catch {
	// ignore
}

// ---------------------------------------------------------------------------
// localStorage tamper detection
// ---------------------------------------------------------------------------

onMounted(() => {
	window.addEventListener('storage', onStorageChange);
	window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
	window.addEventListener(PERMISSION_DENIED_EVENT, onPermissionDenied);
	window.addEventListener('popstate', onCartHistoryNavigation);
	window.addEventListener('click', onWindowClickForLanguageMenu);
});

onUnmounted(() => {
	window.removeEventListener('storage', onStorageChange);
	window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
	window.removeEventListener(PERMISSION_DENIED_EVENT, onPermissionDenied);
	window.removeEventListener('popstate', onCartHistoryNavigation);
	window.removeEventListener('click', onWindowClickForLanguageMenu);
	clearPermissionBanner();
	clearAuthExpiryTimer();
});

function clearPermissionBanner() {
	permissionDeniedMessage.value = '';
	if (permissionBannerTimer != null) {
		window.clearTimeout(permissionBannerTimer);
		permissionBannerTimer = null;
	}
}

function onPermissionDenied(event) {
	const message = String(event?.detail?.message ?? '').trim() || t('errors.permissionDeniedAction');
	permissionDeniedMessage.value = message;

	if (permissionBannerTimer != null) window.clearTimeout(permissionBannerTimer);
	permissionBannerTimer = window.setTimeout(() => {
		permissionDeniedMessage.value = '';
		permissionBannerTimer = null;
	}, PERMISSION_BANNER_TIMEOUT_MS);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function handleLoginSuccess(user) {
	setAuth(user);

	if (isEmployee.value) {
		router.push({ name: 'employee-orders' });
		return;
	}

	if (isAdmin.value) {
		router.push({ name: 'admin' });
		return;
	}

	// If the logged-in user isn't admin, redirect away from admin.
	if (!isAdmin.value && route.name === 'admin') {
		router.push({ name: 'menu' });
	}
}

function handleLogout() {
	doLogout();
	router.push({ name: 'menu' });
}

function requestLogout() {
	logoutConfirmOpen.value = true;
}

function cancelLogout() {
	logoutConfirmOpen.value = false;
}

function confirmLogout() {
	logoutConfirmOpen.value = false;
	doLogout();
	router.push({ name: 'menu' });
}

watch(
	() => auth.value?.token,
	(token) => {
		scheduleAuthExpiry(token || null, handleLogout);
	},
	{ immediate: true },
);

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function goMenu() {
	selectedMenuItem.value = null;
	sessionStorage.removeItem('selectedMenuItem');
	router.push({ name: 'menu' });
}

function goAccount() {
	router.push({ name: 'account' });
}

function goAdmin() {
	if (!(isLoggedIn.value && isAdmin.value)) return;
	router.push({ name: 'admin' });
}

function openMenuItem(itemData) {
	selectedMenuItem.value = itemData;
	try {
		sessionStorage.setItem('selectedMenuItem', JSON.stringify(itemData));
	} catch {
		// ignore
	}
	router.push({ name: 'menu-item' }).catch(() => {});
}

function handleAddToCart(itemData) {
	addItem(itemData);
}

const isMenuRoute = computed(() => route.name === 'menu' || route.name === 'menu-item');
const isAdminRoute = computed(() => route.name === 'admin');
const isAccountRoute = computed(() => route.name === 'account');
const isAboutRoute = computed(() => route.name === 'about');
const mobileNavColsClass = computed(() => (isLoggedIn.value && isAdmin.value ? 'grid-cols-3' : 'grid-cols-2'));

const currentRouteProps = computed(() => {
	if (route.name === 'account') {
		return { auth: auth.value };
	}
	if (route.name === 'menu-item') {
		return { itemData: selectedMenuItem.value };
	}
	return {};
});

function goAbout() {
	router.push({ name: 'about' });
}

function isCartHistoryState(state) {
	return Boolean(state?.[CART_HISTORY_STATE_KEY]);
}

function openCart() {
	if (cartOpen.value) return;

	cartOpen.value = true;
	if (typeof window === 'undefined' || isCartHistoryState(window.history.state)) return;

	window.history.pushState(
		{
			...(window.history.state ?? {}),
			[CART_HISTORY_STATE_KEY]: true,
		},
		'',
		window.location.href,
	);
}

function closeCart({ syncHistory = true } = {}) {
	if (!cartOpen.value) return;

	if (syncHistory && typeof window !== 'undefined' && isCartHistoryState(window.history.state)) {
		window.history.back();
		return;
	}

	cartOpen.value = false;
}

function onCartHistoryNavigation(event) {
	if (isCartHistoryState(event?.state)) {
		cartOpen.value = true;
		return;
	}

	if (cartOpen.value) {
		closeCart({ syncHistory: false });
	}
}

function toggleLanguageMenu(event) {
	event.stopPropagation();
	languageMenuOpen.value = !languageMenuOpen.value;
}

function closeLanguageMenu() {
	languageMenuOpen.value = false;
}

function onWindowClickForLanguageMenu(event) {
	const target = event?.target;
	if (!target) {
		languageMenuOpen.value = false;
		return;
	}

	const inMobileMenu = mobileLanguageMenuRef.value?.contains?.(target);
	const inDesktopMenu = desktopLanguageMenuRef.value?.contains?.(target);
	if (inMobileMenu || inDesktopMenu) return;

	languageMenuOpen.value = false;
}

function selectLocale(nextLocaleValue) {
	const nextLocale = setLocale(nextLocaleValue);
	router.replace({
		query: {
			...route.query,
			[LOCALE_QUERY_KEY]: nextLocale,
		},
	});
	closeLanguageMenu();
}
</script>

<template>
	<div class="flex min-h-screen flex-col">
		<div v-if="permissionDeniedMessage" class="fixed inset-x-0 top-3 z-50 px-4 sm:px-6 lg:px-8" role="status" aria-live="polite">
			<div class="mx-auto flex w-full max-w-3xl items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-md">
				<p>{{ permissionDeniedMessage }}</p>
				<button
					type="button"
					class="rounded p-1 text-amber-900/80 hover:bg-amber-100 hover:text-amber-900"
					:aria-label="t('common.close')"
					@click="clearPermissionBanner"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>
		</div>

		<header v-if="!isEmployee" class="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
			<div class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
				<div class="flex items-center justify-between gap-2">
					<button type="button" class="text-lg font-bold text-gray-900" @click="goMenu">{{ t('common.appName') }}</button>

					<div class="flex items-center gap-2 sm:hidden">
						<div ref="mobileLanguageMenuRef" class="relative">
							<button
								type="button"
								class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2.5 text-gray-700 hover:bg-gray-100"
								:aria-label="t('common.language')"
								:title="t('common.language')"
								@click="toggleLanguageMenu"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 0c2.1 2.3 3.3 5.7 3.3 9S14.1 18.7 12 21m0-18C9.9 5.3 8.7 8.7 8.7 12s1.2 6.7 3.3 9m-8.7-9h17.4" />
								</svg>
							</button>
							<div
								v-if="languageMenuOpen"
								class="absolute right-0 top-12 z-20 w-40 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
							>
								<ul class="max-h-48 overflow-y-auto py-1">
									<li v-for="option in localeOptions" :key="`mobile-locale-${option.value}`">
										<button
											type="button"
											class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
											:class="option.value === currentLocale ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-700'"
											@click="selectLocale(option.value)"
										>
											{{ option.label }}
										</button>
									</li>
								</ul>
							</div>
						</div>

						<!-- Cart button (mobile) -->
						<button
							type="button"
							class="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2.5 text-gray-700 hover:bg-gray-100"
							:aria-label="t('nav.cart')"
							@click="openCart"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 7h12.8M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
							</svg>
							<span
								v-if="totalItems > 0"
								class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white"
							>{{ totalItems }}</span>
						</button>

						<button
							type="button"
							class="inline-flex min-h-10 max-w-[9rem] items-center justify-center truncate rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
							@click="goAccount"
						>
							{{ isLoggedIn ? (auth.teljesNev || auth.email || t('common.user')) : t('nav.login') }}
						</button>
					</div>
				</div>

				<nav :class="['grid w-full gap-2', mobileNavColsClass, 'sm:flex sm:w-auto sm:items-center sm:gap-2']">
					<button
						type="button"
						class="w-full rounded-md px-3 py-2 text-sm font-semibold sm:w-auto"
						:class="isMenuRoute ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
						@click="goMenu"
					>
						{{ t('nav.menu') }}
					</button>
					<button
						type="button"
						class="w-full rounded-md px-3 py-2 text-sm font-semibold sm:w-auto"
						:class="isAboutRoute ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
						@click="goAbout"
					>
						{{ t('nav.about') }}
					</button>
					<button
						v-if="isLoggedIn && isAdmin"
						type="button"
						class="w-full rounded-md px-3 py-2 text-sm font-semibold sm:w-auto"
						:class="isAdminRoute ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
						@click="goAdmin"
					>
						{{ t('nav.admin') }}
					</button>
				</nav>

				<div class="hidden items-center gap-3 sm:flex">
					<button
						v-if="isDevServerDiscoveryEnabled"
						type="button"
						class="relative hidden items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 sm:inline-flex"
						title="Developer server discovery"
						aria-label="Developer server discovery"
						@click="serverDiscoveryOpen = true"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
						</svg>
						<span
							v-if="serverReachable !== null"
							class="absolute right-1 top-1 h-2 w-2 rounded-full"
							:class="serverReachable ? 'bg-green-500' : 'bg-red-500'"
						></span>
					</button>

					<div ref="desktopLanguageMenuRef" class="relative">
						<button
							type="button"
							class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2.5 text-gray-700 hover:bg-gray-100"
							:aria-label="t('common.language')"
							:title="t('common.language')"
							@click="toggleLanguageMenu"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 0c2.1 2.3 3.3 5.7 3.3 9S14.1 18.7 12 21m0-18C9.9 5.3 8.7 8.7 8.7 12s1.2 6.7 3.3 9m-8.7-9h17.4" />
							</svg>
						</button>
						<div
							v-if="languageMenuOpen"
							class="absolute right-0 top-12 z-20 w-40 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
						>
							<ul class="max-h-48 overflow-y-auto py-1">
								<li v-for="option in localeOptions" :key="`desktop-locale-${option.value}`">
									<button
										type="button"
										class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
										:class="option.value === currentLocale ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-700'"
										@click="selectLocale(option.value)"
									>
										{{ option.label }}
									</button>
								</li>
							</ul>
						</div>
					</div>

					<!-- Cart button (desktop) -->
					<button
						type="button"
						class="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2.5 text-gray-700 hover:bg-gray-100"
						:aria-label="t('nav.cart')"
						@click="openCart"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 7h12.8M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
						</svg>
						<span
							v-if="totalItems > 0"
							class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white"
						>{{ totalItems }}</span>
					</button>

					<button
						type="button"
						class="hidden rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 sm:inline-flex"
						:class="isAccountRoute ? 'bg-gray-900 text-white hover:bg-gray-900' : ''"
						@click="goAccount"
					>
						{{ isLoggedIn ? (auth.teljesNev || auth.email || t('common.user')) : t('nav.login') }}
					</button>
				</div>
			</div>
		</header>

		<main class="grow">
			<router-view v-slot="{ Component }">
				<component
					:is="Component"
					v-bind="currentRouteProps"
					@open-item="openMenuItem"
					@back="goMenu"
					@login-success="handleLoginSuccess"
					@logout="requestLogout"
					@add-to-cart="handleAddToCart"
				/>
			</router-view>
		</main>

		<CartDrawer v-if="!isEmployee" :open="cartOpen" :auth="auth" @close="closeCart" />

		<FooterSection v-if="!isEmployee" />

		<ServerDiscovery
			v-if="isDevServerDiscoveryEnabled && serverDiscoveryOpen"
			@close="serverDiscoveryOpen = false"
			@server-changed="(url) => { serverReachable = url !== null; serverDiscoveryOpen = false; }"
		/>

		<ConfirmModal
			:show="logoutConfirmOpen"
			:title="t('nav.logoutConfirmTitle')"
			:message="t('nav.logoutConfirmMessage')"
			:confirm-label="t('nav.logout')"
			:cancel-label="t('common.cancel')"
			confirm-variant="danger"
			@cancel="cancelLogout"
			@confirm="confirmLogout"
		/>
	</div>
</template>
