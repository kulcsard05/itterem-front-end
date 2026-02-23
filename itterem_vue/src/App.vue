<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CartDrawer from './components/CartDrawer.vue';
import { useCart } from './composables/useCart.js';
import {
	AUTH_EXPIRED_EVENT,
	clearStoredAuth,
	getJwtExpirationMs,
	isJwtExpired,
	readStoredAuth,
} from './utils.js';

const router = useRouter();
const route = useRoute();

const auth = ref(null);
const selectedMenuItem = ref(null);
const cartOpen = ref(false);
let authExpiryTimer = null;

const { addItem, totalItems } = useCart();

function migrateAuthShape(value) {
	if (!value || typeof value !== 'object') return { auth: value, changed: false };

	const legacyPhone = String(value.telefonszam ?? value.telefonSzam ?? value.telefon_szam ?? value.phone ?? '').trim();
	const next = { ...value };
	let changed = false;

	if (!String(next.telefonszam ?? '').trim() && legacyPhone) {
		next.telefonszam = legacyPhone;
		changed = true;
	}

	if ('telefonSzam' in next) {
		delete next.telefonSzam;
		changed = true;
	}
	if ('telefon_szam' in next) {
		delete next.telefon_szam;
		changed = true;
	}
	if ('phone' in next) {
		delete next.phone;
		changed = true;
	}

	return { auth: next, changed };
}

try {
	const parsed = readStoredAuth();
	const migrated = migrateAuthShape(parsed);
	auth.value = migrated.auth;
	if (migrated.changed && migrated.auth) {
		localStorage.setItem('auth', JSON.stringify(migrated.auth));
	}
} catch {
	auth.value = null;
}

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

function onStorageChange(event) {
	if (event.key !== 'auth') return;
	const next = readStoredAuth();
	if (!next || !next.token) {
		handleLogout();
		return;
	}

	if (isJwtExpired(next.token)) {
		handleLogout();
		return;
	}

	if (auth.value && String(next.jogosultsag) !== String(auth.value.jogosultsag)) {
		handleLogout();
	}
}

function onAuthExpired() {
	handleLogout();
}

window.addEventListener('storage', onStorageChange);
window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);

function clearAuthExpiryTimer() {
	if (authExpiryTimer != null) {
		window.clearTimeout(authExpiryTimer);
		authExpiryTimer = null;
	}
}

function scheduleAuthExpiry(token) {
	clearAuthExpiryTimer();
	if (!token) return;

	if (isJwtExpired(token)) {
		handleLogout();
		return;
	}

	const expiryMs = getJwtExpirationMs(token);
	if (expiryMs == null) return;

	const delay = Math.max(0, expiryMs - Date.now());
	authExpiryTimer = window.setTimeout(() => {
		handleLogout();
	}, delay);
}

onUnmounted(() => {
	window.removeEventListener('storage', onStorageChange);
	window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
	clearAuthExpiryTimer();
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function handleLoginSuccess(user) {
	localStorage.setItem('auth', JSON.stringify(user));
	auth.value = user;

	// If the logged-in user isn't admin, redirect away from admin.
	if (Number(user?.jogosultsag) !== 3 && route.name === 'admin') {
		router.push({ name: 'menu' });
	}
}

function handleLogout() {
	clearStoredAuth();
	auth.value = null;
	router.push({ name: 'menu' });
}

const isLoggedIn = computed(() => Boolean(auth.value && auth.value.token));
const isAdmin = computed(() => Number(auth.value?.jogosultsag) === 3);

watch(
	() => auth.value,
	() => {
		if (!isAdmin.value && route.name === 'admin') {
			router.push({ name: 'menu' });
		}
	},
	{ deep: true },
);

watch(
	() => auth.value?.token,
	(token) => {
		scheduleAuthExpiry(token || null);
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
	router.push({ name: 'menu-item' });
}

function handleAddToCart(itemData) {
	addItem(itemData);
}

const isMenuRoute = computed(() => route.name === 'menu' || route.name === 'menu-item');
const isAdminRoute = computed(() => route.name === 'admin');
const isAccountRoute = computed(() => route.name === 'account');
const isAboutRoute = computed(() => route.name === 'about');

function goAbout() {
	router.push({ name: 'about' });
}
</script>

<template>
	<div class="flex min-h-screen flex-col">
		<header class="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
			<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
				<button type="button" class="text-lg font-bold text-gray-900" @click="goMenu">Itterem</button>

				<nav class="flex items-center gap-2">
					<button
						type="button"
						class="rounded-md px-3 py-2 text-sm font-semibold"
						:class="isMenuRoute ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
						@click="goMenu"
					>
						Étlap
					</button>
					<button
						type="button"
						class="rounded-md px-3 py-2 text-sm font-semibold"
						:class="isAboutRoute ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
						@click="goAbout"
					>
						Rólunk
					</button>
					<button
						v-if="isLoggedIn && isAdmin"
						type="button"
						class="rounded-md px-3 py-2 text-sm font-semibold"
						:class="isAdminRoute ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
						@click="goAdmin"
					>
						Admin
					</button>
				</nav>

				<div class="flex items-center gap-3">
					<!-- Cart button (always visible) -->
					<button
						type="button"
						class="relative inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100"
						aria-label="Kosár"
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
						{{ auth.teljesNev || auth.email || 'Felhasználó' }}
					</button>

					<button
						v-if="isLoggedIn"
						type="button"
						class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
						@click="handleLogout"
					>
						Kijelentkezés
					</button>
					<button
						v-else
						type="button"
						class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
						@click="goAccount"
					>
						Bejelentkezés
					</button>
				</div>
			</div>
		</header>

		<main class="grow">
			<router-view v-slot="{ Component, route: currentRoute }">
				<component
					:is="Component"
					v-bind="
						currentRoute.name === 'account'
							? { auth }
							: currentRoute.name === 'menu-item'
								? { itemData: selectedMenuItem }
								: {}
					"
					@open-item="openMenuItem"
					@back="goMenu"
					@login-success="handleLoginSuccess"
					@logout="handleLogout"
					@add-to-cart="handleAddToCart"
				/>
			</router-view>
		</main>

		<CartDrawer :open="cartOpen" :auth="auth" @close="cartOpen = false" />

		<!-- Footer -->
		<footer class="mt-auto border-t border-gray-200 bg-gray-50">
			<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
				<div class="grid gap-10 md:grid-cols-2 lg:grid-cols-3">

					<!-- Brand & description -->
					<div>
						<p class="text-lg font-bold text-gray-900">Itterem</p>
						<p class="mt-2 text-sm text-gray-500 leading-relaxed">
							Friss alapanyagok, szívből jövő ételek – minden nap, minden vendégnek.
						</p>
					</div>

					<!-- Contact info -->
					<div>
						<p class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-900">Elérhetőség</p>
						<ul class="space-y-2 text-sm text-gray-600">
							<li class="flex items-start gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								<span>1052 Budapest, Váci utca 1.</span>
							</li>
							<li class="flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
								</svg>
								<a href="tel:+3612345678" class="hover:text-indigo-600">+36 1 234 5678</a>
							</li>
							<li class="flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
								</svg>
								<a href="mailto:info@itterem.hu" class="hover:text-indigo-600">info@itterem.hu</a>
							</li>
							<li class="flex items-start gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span>H–P: 10:00–22:00<br>Szo–V: 11:00–23:00</span>
							</li>
						</ul>
					</div>

					<!-- Google Maps embed -->
					<div class="md:col-span-2 lg:col-span-1">
						<p class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-900">Megközelítés</p>
						<div class="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
							<iframe
								src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2695.5!2d19.0503!3d47.4984!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4741dc6b7a0b0001%3A0x9e6a7f1e4b2c3d4e!2sV%C3%A1ci%20utca%2C%20Budapest!5e0!3m2!1shu!2shu!4v1700000000000!5m2!1shu!2shu"
								width="100%"
								height="220"
								style="border:0;"
								allowfullscreen
								loading="lazy"
								referrerpolicy="no-referrer-when-downgrade"
								title="Itterem helyszín"
							></iframe>
						</div>
					</div>

				</div>

				<div class="mt-10 border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
					&copy; {{ new Date().getFullYear() }} Itterem. Minden jog fenntartva.
				</div>
			</div>
		</footer>
	</div>
</template>
