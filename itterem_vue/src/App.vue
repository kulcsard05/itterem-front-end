<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CartDrawer from './components/user/CartDrawer.vue';
import FooterSection from './components/public/FooterSection.vue';
import { useCart } from './composables/useCart.js';
import { useAuth } from './composables/useAuth.js';
import { AUTH_EXPIRED_EVENT } from './constants.js';

const router = useRouter();
const route = useRoute();

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

const { addItem, totalItems } = useCart();

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

window.addEventListener('storage', onStorageChange);
window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);

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

function goAbout() {
	router.push({ name: 'about' });
}
</script>

<template>
	<div class="flex min-h-screen flex-col">
		<header v-if="!isEmployee" class="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
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
							: currentRoute.name === 'employee-orders'
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

		<CartDrawer v-if="!isEmployee" :open="cartOpen" :auth="auth" @close="cartOpen = false" />

		<FooterSection v-if="!isEmployee" />
	</div>
</template>
