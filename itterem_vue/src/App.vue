<script setup>
import { computed, ref, watch } from 'vue';
import AdminDashboard from './components/AdminDashboard.vue';
import MenuItemPage from './components/MenuItemPage.vue';
import MenuView from './components/MenuView.vue';
import UserPage from './components/UserPage.vue';

const auth = ref(null);
const page = ref('menu');
const selectedMenuItem = ref(null);
const cart = ref([]);

try {
	const raw = localStorage.getItem('auth');
	auth.value = raw ? JSON.parse(raw) : null;
} catch {
	auth.value = null;
}

function handleLoginSuccess(user) {
    localStorage.setItem('auth', JSON.stringify(user));
    auth.value = user;

    // If the logged-in user isn't admin, force-close admin view.
	if (Number(user?.jogosultsag) !== 1 && page.value === 'admin') page.value = 'menu';
}

function handleLogout() {
	localStorage.removeItem('auth');
	auth.value = null;
	page.value = 'menu';
}

const isLoggedIn = computed(() => Boolean(auth.value && auth.value.token));
const isAdmin = computed(() => Number(auth.value?.jogosultsag) === 1);

watch(
	() => auth.value,
	() => {
		if (!isAdmin.value && page.value === 'admin') page.value = 'menu';
	},
	{ deep: true }
);

function goMenu() {
	page.value = 'menu';
  selectedMenuItem.value = null;
}

function goAccount() {
	page.value = 'account';
}

function goAdmin() {
	if (!(isLoggedIn.value && isAdmin.value)) return;
	page.value = 'admin';
}

function openMenuItem(itemData) {
  selectedMenuItem.value = itemData;
  page.value = 'item';
}

function addToCart(itemData) {
  if (!itemData) return;
  cart.value = [...cart.value, itemData];
}
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
            :class="page === 'menu' || page === 'item' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
            @click="goMenu"
          >
            Menu
          </button>
          <button
            v-if="isLoggedIn && isAdmin"
            type="button"
            class="rounded-md px-3 py-2 text-sm font-semibold"
            :class="page === 'admin' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
            @click="goAdmin"
          >
            Admin
          </button>
        </nav>

        <div class="flex items-center gap-3">
          <button
            v-if="isLoggedIn"
            type="button"
            class="hidden rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 sm:inline-flex"
            :class="page === 'account' ? 'bg-gray-900 text-white hover:bg-gray-900' : ''"
            @click="goAccount"
          >
            {{ auth.teljesNev || auth.email || 'User' }}
          </button>

          <button
            v-if="isLoggedIn"
            type="button"
            class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            @click="handleLogout"
          >
            Logout
          </button>
          <button
            v-else
            type="button"
            class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            @click="goAccount"
          >
            Sign in
          </button>
        </div>
      </div>
    </header>

    <main>
      <AdminDashboard v-if="page === 'admin'" :onBack="goMenu" :onLogout="handleLogout" />
      <MenuItemPage
        v-else-if="page === 'item'"
        :itemData="selectedMenuItem"
        :onBack="goMenu"
        :onAddToCart="addToCart"
      />
      <MenuView v-else-if="page === 'menu'" :onOpenItem="openMenuItem" />
      <UserPage v-else :auth="auth" :onLoginSuccess="handleLoginSuccess" :onLogout="handleLogout" />
    </main>
  </div>
</template>
