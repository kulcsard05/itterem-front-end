<script setup>
import { computed, ref, watch } from 'vue';
import AdminDashboard from './components/AdminDashboard.vue';
import MenuView from './components/MenuView.vue';
import UserPage from './components/UserPage.vue';

const auth = ref(null);
const page = ref('menu');

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
}

function goAccount() {
	page.value = 'account';
}

function goAdmin() {
	if (!(isLoggedIn.value && isAdmin.value)) return;
	page.value = 'admin';
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
            :class="page === 'menu' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
            @click="goMenu"
          >
            Menu
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-2 text-sm font-semibold"
            :class="page === 'account' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
            @click="goAccount"
          >
            Account
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
          <div v-if="isLoggedIn" class="hidden text-right sm:block">
            <div class="text-sm font-semibold text-gray-900">{{ auth.teljesNev || auth.email || 'User' }}</div>
            <div class="text-xs text-gray-600">Role: {{ String(auth.jogosultsag ?? '-') }}</div>
          </div>

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
      <MenuView v-else-if="page === 'menu'" />
      <UserPage v-else :auth="auth" :onLoginSuccess="handleLoginSuccess" :onLogout="handleLogout" />
    </main>
  </div>
</template>
