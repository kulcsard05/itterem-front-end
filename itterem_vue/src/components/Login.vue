<script setup>
import { computed, ref } from 'vue';
import { login } from '../api';

const props = defineProps({
	onSwitch: {
		type: Function,
		default: undefined,
	},
	onLoginSuccess: {
		type: Function,
		default: undefined,
	},
});

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const fieldErrors = ref({ email: '', password: '' });

function isValidEmail(value) {
	const v = String(value || '').trim();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function validate() {
	const next = { email: '', password: '' };
	const emailValue = String(email.value || '').trim();
	const passwordValue = String(password.value || '');

	if (!emailValue) next.email = 'Email is required.';
	else if (!isValidEmail(emailValue)) next.email = 'Please enter a valid email address.';

	if (!passwordValue) next.password = 'Password is required.';

	fieldErrors.value = next;
	return !next.email && !next.password;
}

const canSubmit = computed(() => {
  if (loading.value) return false;
  const emailValue = String(email.value || '').trim();
  const passwordValue = String(password.value || '');
  return Boolean(emailValue && passwordValue && isValidEmail(emailValue));
});

async function onSubmit(e) {
	e.preventDefault();

	error.value = '';

	if (!validate()) return;
	loading.value = true;
	
	try {
		const result = await login(String(email.value || '').trim(), String(password.value || ''));
		if (result.ok) {
		// Let the parent decide what to do with the user/token.
		props.onLoginSuccess?.(result.user);
		} else {
		error.value = result.message || 'Hibás név vagy jelszó';
		}
	} catch (err) {
		error.value = err?.message || 'Login failed';
	} finally {
		loading.value = false;
	}
}
</script>

<template>
  <div class="w-full max-w-md bg-white rounded-lg shadow-md p-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <h2 class="text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
        Sign in to your account
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <form class="space-y-6" action="#" method="POST" @submit="onSubmit">
        <div>
          <label for="email" class="block text-sm font-medium leading-6 text-gray-900">
            Email address
          </label>
          <div class="mt-2">
            <input
              id="email"
              v-model="email"
              name="email"
              type="email"
              autocomplete="email"
              required
              class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            />
          </div>
          <p v-if="fieldErrors.email" class="mt-2 text-sm text-red-600">{{ fieldErrors.email }}</p>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <label for="password" class="block text-sm font-medium leading-6 text-gray-900">
              Password
            </label>
            <div class="text-sm">
              <button type="button" class="font-semibold text-indigo-600 hover:text-indigo-500">
                Forgot password?
              </button>
            </div>
          </div>
          <div class="mt-2">
            <input
              id="password"
              v-model="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            />
          </div>
          <p v-if="fieldErrors.password" class="mt-2 text-sm text-red-600">{{ fieldErrors.password }}</p>
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <div>
          <button
            type="submit"
            :disabled="!canSubmit"
            class="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </button>
        </div>
      </form>

      <p class="mt-10 text-center text-sm text-gray-500">
        Not a member?
        <button
          type="button"
          class="font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
          @click="props.onSwitch && props.onSwitch()"
        >
          Register now
        </button>
      </p>
    </div>
  </div>
</template>
