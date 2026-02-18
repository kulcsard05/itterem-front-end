<script setup>
import { computed, ref, watch } from 'vue';
import Login from './Login.vue';
import Register from './Register.vue';

const props = defineProps({
	auth: { type: Object, default: null },
	onLoginSuccess: { type: Function, default: undefined },
	onLogout: { type: Function, default: undefined },
});

const currentForm = ref('login');
const isEditingPhone = ref(false);
const phoneInput = ref('');
const phoneError = ref('');
const phoneSuccess = ref('');

function getPhoneFromAuth(auth) {
  if (!auth) return '';
  return String(auth.telefonSzam ?? auth.telefonszam ?? auth.telefon_szam ?? auth.phone ?? '').trim();
}

function isValidPhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (!/^[0-9+()\-\s.]+$/.test(raw)) return false;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7;
}

const currentPhone = computed(() => getPhoneFromAuth(props.auth));

watch(
  () => props.auth,
  (next) => {
    if (!isEditingPhone.value) {
      phoneInput.value = getPhoneFromAuth(next);
    }
  },
  { immediate: true, deep: true }
);

function startPhoneEdit() {
  phoneError.value = '';
  phoneSuccess.value = '';
  phoneInput.value = currentPhone.value;
  isEditingPhone.value = true;
}

function cancelPhoneEdit() {
  phoneError.value = '';
  phoneInput.value = currentPhone.value;
  isEditingPhone.value = false;
}

function savePhone() {
  phoneError.value = '';
  phoneSuccess.value = '';

  const nextPhone = String(phoneInput.value || '').trim();
  if (!isValidPhone(nextPhone)) {
    phoneError.value = 'Please enter a valid phone number.';
    return;
  }

  const updatedUser = {
    ...(props.auth || {}),
    telefonSzam: nextPhone,
    telefonszam: nextPhone,
    phone: nextPhone,
  };

  try {
    localStorage.setItem('auth', JSON.stringify(updatedUser));
  } catch {
    // ignore storage errors and still update in-memory state via callback
  }

  props.onLoginSuccess?.(updatedUser);
  isEditingPhone.value = false;
  phoneSuccess.value = 'Phone number saved.';
}

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

          <div class="mt-4">
            <div class="text-sm text-gray-600">Phone number</div>

            <div v-if="!isEditingPhone" class="mt-1 flex items-center gap-3">
              <div class="text-sm text-gray-900">{{ currentPhone || '-' }}</div>
              <button
                type="button"
                class="rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
                @click="startPhoneEdit"
              >
                Edit
              </button>
            </div>

            <div v-else class="mt-2 flex flex-wrap items-start gap-2">
              <input
                v-model="phoneInput"
                type="tel"
                autocomplete="tel"
                class="w-full max-w-xs rounded-md border-0 px-3 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
              />
              <button
                type="button"
                class="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
                @click="savePhone"
              >
                Save
              </button>
              <button
                type="button"
                class="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
                @click="cancelPhoneEdit"
              >
                Cancel
              </button>
            </div>

            <p v-if="phoneError" class="mt-2 text-sm text-red-600">{{ phoneError }}</p>
            <p v-else-if="phoneSuccess" class="mt-2 text-sm text-green-600">{{ phoneSuccess }}</p>
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
