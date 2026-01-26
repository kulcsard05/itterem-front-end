<script setup>
import { computed, ref, watch } from 'vue';
import Login from './components/Login.vue';
import Register from './components/Register.vue';
import AdminDashboard from './components/AdminDashboard.vue';

const currentForm = ref('login');
const showAdmin = ref(false);
const auth = ref(null);

try {
  const raw = localStorage.getItem('auth');
  auth.value = raw ? JSON.parse(raw) : null;
} catch {
  auth.value = null;
}

function toggleForm() {
  currentForm.value = currentForm.value === 'login' ? 'register' : 'login';
}

function handleLoginSuccess(user) {
  localStorage.setItem('auth', JSON.stringify(user));
  auth.value = user;
  // If the logged-in user isn't admin, force-close admin view.
  if (Number(user?.jogosultsag) !== 2) showAdmin.value = false;
}

function handleLogout() {
  localStorage.removeItem('auth');
  auth.value = null;
  currentForm.value = 'login';
  showAdmin.value = false;
}

const isAdmin = computed(() => Number(auth.value?.jogosultsag) === 1);

watch(
  () => auth.value,
  () => {
    if (!isAdmin.value) showAdmin.value = false;
  },
  { deep: true }
);

function toggleAdmin() {
  if (!(auth.value && auth.value.token && isAdmin.value)) return;
  showAdmin.value = !showAdmin.value;
}
</script>

<template>
  <!-- Admin Dashboard View -->
  <AdminDashboard
    v-if="showAdmin && auth && auth.token && isAdmin"
    :onBack="toggleAdmin"
    :onLogout="handleLogout"
  />
  
  <!-- Regular Auth View -->
  <div v-else class="min-h-screen bg-gray-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
    <div v-if="auth && auth.token" class="w-full max-w-md bg-white rounded-lg shadow-md p-8">
      <h2 class="text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">You are signed in</h2>
      <div class="mt-6 text-sm text-gray-700 space-y-2">
        <div><span class="font-semibold">Name:</span> {{ auth.teljesNev || '-' }}</div>
        <div><span class="font-semibold">Email:</span> {{ auth.email || '-' }}</div>
        <div><span class="font-semibold">Role:</span> {{ String(auth.jogosultsag ?? '-') }}</div>
      </div>
      <button
        v-if="isAdmin"
        type="button"
        class="mt-6 flex w-full justify-center rounded-md bg-purple-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-purple-500"
        @click="toggleAdmin"
      >
        View Admin Dashboard
      </button>
      <button
        type="button"
        class="mt-4 flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500"
        @click="handleLogout"
      >
        Logout
      </button>
    </div>
    <Login v-else-if="currentForm === 'login'" :onSwitch="toggleForm" :onLoginSuccess="handleLoginSuccess" />
    <Register v-else :onSwitch="toggleForm" />
  </div>
</template>
