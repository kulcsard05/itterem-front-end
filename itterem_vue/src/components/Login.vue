<script setup>
import { computed, ref, watch } from 'vue';
import { login } from '../api';
import { isValidEmail } from '../utils.js';

const emit = defineEmits(['switch', 'login-success']);

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const fieldErrors = ref({ email: '', password: '' });
const submitAttempted = ref(false);

function validate() {
	const next = { email: '', password: '' };
	const emailValue = email.value.trim();
	const passwordValue = password.value;

	if (!emailValue) next.email = 'Email cím megadása kötelező.';
	else if (!isValidEmail(emailValue)) next.email = 'Kérjük, adj meg egy érvényes email címet.';

	if (!passwordValue) next.password = 'Jelszó megadása kötelező.';

	fieldErrors.value = next;
	return !next.email && !next.password;
}

const canSubmit = computed(() => {
	if (loading.value) return false;
	const emailValue = email.value.trim();
	const passwordValue = password.value;
	return Boolean(emailValue && passwordValue && isValidEmail(emailValue));
});

watch([email, password], () => {
	if (!submitAttempted.value) return;
	validate();
});

async function onSubmit() {
	error.value = '';
	submitAttempted.value = true;

	if (!validate()) {
		error.value = 'Kérjük, javítsd a kijelölt mezőket.';
		return;
	}
	loading.value = true;

	try {
		const result = await login(email.value.trim(), password.value);
		if (result.ok) {
			emit('login-success', result.user);
		} else {
			error.value = result.message || 'Hibás email vagy jelszó';
		}
	} catch (err) {
		error.value = err?.message || 'Bejelentkezés sikertelen';
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<div class="w-full max-w-md bg-white rounded-lg shadow-md p-8">
		<div class="sm:mx-auto sm:w-full sm:max-w-sm">
			<h2 class="text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
				Bejelentkezés
			</h2>
		</div>

		<div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
			<form class="space-y-6" @submit.prevent="onSubmit">
				<div>
					<label for="email" class="block text-sm font-medium leading-6 text-gray-900"> Email cím </label>
					<div class="mt-2">
						<input
							id="email"
							v-model="email"
							name="email"
							type="email"
							autocomplete="email"
							required
							:class="[
								'block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
								fieldErrors.email
									? 'ring-red-500 focus:ring-red-600'
									: 'ring-gray-300 focus:ring-indigo-600',
							]"
						/>
					</div>
					<p v-if="fieldErrors.email" class="mt-2 text-sm text-red-600">{{ fieldErrors.email }}</p>
				</div>

				<div>
					<div class="flex items-center justify-between">
						<label for="password" class="block text-sm font-medium leading-6 text-gray-900">
							Jelszó
						</label>
						<div class="text-sm">
							<span
								class="font-semibold text-gray-400 cursor-not-allowed"
								title="Hamarosan elérhető"
							>
								Elfelejtett jelszó?
							</span>
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
							:class="[
								'block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
								fieldErrors.password
									? 'ring-red-500 focus:ring-red-600'
									: 'ring-gray-300 focus:ring-indigo-600',
							]"
						/>
					</div>
					<p v-if="fieldErrors.password" class="mt-2 text-sm text-red-600">{{ fieldErrors.password }}</p>
				</div>

				<p v-if="error" class="text-sm text-red-600">{{ error }}</p>

				<div>
					<button
						type="submit"
						:disabled="loading"
						:class="[
							'flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
							loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500',
							!loading && !canSubmit ? 'opacity-90' : '',
						]"
					>
						{{ loading ? 'Bejelentkezés…' : 'Bejelentkezés' }}
					</button>
				</div>
			</form>

			<p class="mt-10 text-center text-sm text-gray-500">
				Nincs még fiókod?
				<button
					type="button"
					class="font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
					@click="emit('switch')"
				>
					Regisztrálj most
				</button>
			</p>
		</div>
	</div>
</template>
