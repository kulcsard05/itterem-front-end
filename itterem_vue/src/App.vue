<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import CartDrawer from './components/user/CartDrawer.vue';
import FooterSection from './components/public/FooterSection.vue';
import ServerDiscovery from './components/ServerDiscovery.vue';
import { useCart } from './composables/useCart.js';
import { useAuth } from './composables/useAuth.js';
import { useLocale } from './composables/useLocale.js';
import { AUTH_EXPIRED_EVENT, LOCALE_QUERY_KEY } from './constants.js';

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
const isDevServerDiscoveryEnabled = import.meta.env.DEV;

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
});

onUnmounted(() => {
	window.removeEventListener('storage', onStorageChange);
	window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
	clearAuthExpiryTimer();
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function handleLoginSuccess(user) {
	setAuth(user);

	if (isEmployee.value) {
		router.push({ name: 'employee-orders' });
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

const currentRouteProps = computed(() => {
	if (route.name === 'account' || route.name === 'employee-orders') {
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

function switchLocale(event) {
	const nextLocale = setLocale(event.target.value);
	router.replace({
		query: {
			...route.query,
			[LOCALE_QUERY_KEY]: nextLocale,
		},
	});
}
</script>

<template>
	<div class="flex min-h-screen flex-col">
		<header v-if="!isEmployee" class="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
			<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
				<button type="button" class="text-lg font-bold text-gray-900" @click="goMenu">{{ t('common.appName') }}</button>

				<nav class="flex items-center gap-2">
					<button
						type="button"
						class="rounded-md px-3 py-2 text-sm font-semibold"
						:class="isMenuRoute ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
						@click="goMenu"
					>
						{{ t('nav.menu') }}
					</button>
					<button
						type="button"
						class="rounded-md px-3 py-2 text-sm font-semibold"
						:class="isAboutRoute ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
						@click="goAbout"
					>
						{{ t('nav.about') }}
					</button>
					<button
						v-if="isLoggedIn && isAdmin"
						type="button"
						class="rounded-md px-3 py-2 text-sm font-semibold"
						:class="isAdminRoute ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
						@click="goAdmin"
					>
						{{ t('nav.admin') }}
					</button>
				</nav>

				<div class="flex items-center gap-3">
					<button
						v-if="isDevServerDiscoveryEnabled"
						type="button"
						class="relative inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100"
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

					<label class="hidden text-xs font-medium uppercase tracking-wide text-gray-500 md:block" for="app-locale">
						{{ t('common.language') }}
					</label>
					<select
						id="app-locale"
						class="rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
						:aria-label="t('common.language')"
						:value="currentLocale"
						@change="switchLocale"
					>
						<option v-for="option in localeOptions" :key="option.value" :value="option.value">
							{{ option.label }}
						</option>
					</select>

					<!-- Cart button (always visible) -->
					<button
						type="button"
						class="relative inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100"
						:aria-label="t('nav.cart')"
						@click="cartOpen = true"
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
						v-if="isLoggedIn"
						type="button"
						class="hidden rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 sm:inline-flex"
						:class="isAccountRoute ? 'bg-gray-900 text-white hover:bg-gray-900' : ''"
						@click="goAccount"
					>
						{{ auth.teljesNev || auth.email || t('common.user') }}
					</button>

					<button
						v-if="isLoggedIn"
						type="button"
						class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
						@click="handleLogout"
					>
						{{ t('nav.logout') }}
					</button>
					<button
						v-else
						type="button"
						class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
						@click="goAccount"
					>
						{{ t('nav.login') }}
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
					@logout="handleLogout"
					@add-to-cart="handleAddToCart"
				/>
			</router-view>
		</main>

		<CartDrawer v-if="!isEmployee" :open="cartOpen" :auth="auth" @close="cartOpen = false" />

		<FooterSection v-if="!isEmployee" />

		<ServerDiscovery
			v-if="isDevServerDiscoveryEnabled && serverDiscoveryOpen"
			@close="serverDiscoveryOpen = false"
			@server-changed="(url) => { serverReachable = url !== null; serverDiscoveryOpen = false; }"
		/>
	</div>
</template>
