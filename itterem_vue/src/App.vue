<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CartDrawer from './components/CartDrawer.vue';
import { useCart } from './composables/useCart.js';

const router = useRouter();
const route = useRoute();

const auth = ref(null);
const selectedMenuItem = ref(null);
const cartOpen = ref(false);

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
	const raw = localStorage.getItem('auth');
	const parsed = raw ? JSON.parse(raw) : null;
	const migrated = migrateAuthShape(parsed);
	auth.value = migrated.auth;
	if (migrated.changed) {
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
	try {
		const next = event.newValue ? JSON.parse(event.newValue) : null;
		if (!next || !next.token) {
			handleLogout();
			return;
		}
		// If jogosultsag changed externally, force logout (possible tampering).
		if (auth.value && String(next.jogosultsag) !== String(auth.value.jogosultsag)) {
			handleLogout();
		}
	} catch {
		handleLogout();
	}
}

window.addEventListener('storage', onStorageChange);
onUnmounted(() => window.removeEventListener('storage', onStorageChange));

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
	localStorage.removeItem('auth');
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
</script>

<template>
	<div class="min-h-screen">
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

		<main>
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
	</div>
</template>
