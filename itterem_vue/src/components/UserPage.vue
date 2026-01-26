<script setup>
import { ref } from 'vue';
import Login from './Login.vue';
import Register from './Register.vue';

const props = defineProps({
  auth: { type: Object, default: null },
  onLoginSuccess: { type: Function, default: undefined },
  onLogout: { type: Function, default: undefined },
});

const currentForm = ref('login');

function toggleForm() {
  currentForm.value = currentForm.value === 'login' ? 'register' : 'login';
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <h1 class="text-2xl font-bold tracking-tight text-gray-900">Account</h1>

    <div v-if="props.auth && props.auth.token" class="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="text-sm text-gray-600">Signed in as</div>
          <div class="mt-1 text-lg font-semibold text-gray-900">{{ props.auth.teljesNev || '-' }}</div>
          <div class="mt-1 text-sm text-gray-700">{{ props.auth.email || '-' }}</div>
          <div class="mt-2 text-sm text-gray-700">
            <span class="font-semibold">Role:</span> {{ String(props.auth.jogosultsag ?? '-') }}
          </div>
        </div>

        <button
          type="button"
          class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          @click="props.onLogout && props.onLogout()"
        >
          Logout
        </button>
      </div>

      <div class="mt-6 text-sm text-gray-600">
        This is your user page. You can extend it with orders, favorites, etc.
      </div>
    </div>

    <div v-else class="mt-8 flex justify-center">
      <Login v-if="currentForm === 'login'" :onSwitch="toggleForm" :onLoginSuccess="props.onLoginSuccess" />
      <Register v-else :onSwitch="toggleForm" />
    </div>
  </div>
</template>
