<script setup>
import { computed, ref, watch } from 'vue';
import { register } from '../api';
import { isValidEmail, isValidPhone } from '../utils.js';

const emit = defineEmits(['switch']);

const fullName = ref('');
const email = ref('');
const phone = ref('');
const password = ref('');

const loading = ref(false);
const error = ref('');
const success = ref('');
const fieldErrors = ref({ fullName: '', email: '', phone: '', password: '' });
const submitAttempted = ref(false);

function validate() {
	const next = { fullName: '', email: '', phone: '', password: '' };
	const fullNameValue = fullName.value.trim();
	const emailValue = email.value.trim();
	const phoneValue = phone.value.trim();
	const passwordValue = password.value;

	if (!fullNameValue) next.fullName = 'Full name is required.';
	else if (fullNameValue.length < 2) next.fullName = 'Full name is too short.';

	if (!emailValue) next.email = 'Email is required.';
	else if (!isValidEmail(emailValue)) next.email = 'Please enter a valid email address.';

	if (!phoneValue) next.phone = 'Phone number is required.';
	else if (!isValidPhone(phoneValue)) next.phone = 'Please enter a valid phone number.';

	if (!passwordValue) next.password = 'Password is required.';
	else if (passwordValue.length < 6) next.password = 'Password must be at least 6 characters.';

	fieldErrors.value = next;
	return !next.fullName && !next.email && !next.phone && !next.password;
}

const isFormValid = computed(() => {
	const fullNameValue = fullName.value.trim();
	const emailValue = email.value.trim();
	const phoneValue = phone.value.trim();
	const passwordValue = password.value;
	return (
		fullNameValue.length >= 2 && isValidEmail(emailValue) && isValidPhone(phoneValue) && passwordValue.length >= 6
	);
});

watch([fullName, email, phone, password], () => {
	if (!submitAttempted.value) return;
	validate();
});

async function onSubmit(e) {
	e.preventDefault();

	error.value = '';
	success.value = '';
	submitAttempted.value = true;

	if (!validate()) {
		error.value = 'Please fix the highlighted fields.';
		return;
	}
	loading.value = true;

	try {
		const result = await register({
			teljesNev: fullName.value.trim(),
			email: email.value.trim(),
			password: password.value,
			telefonSzam: phone.value.trim(),
		});

		if (result.ok) {
			success.value = 'Registration successful. Please sign in.';
			fullName.value = '';
			email.value = '';
			phone.value = '';
			password.value = '';
			submitAttempted.value = false;
			fieldErrors.value = { fullName: '', email: '', phone: '', password: '' };
			// Switch back to login (backend doesn't return token here).
			setTimeout(() => emit('switch'), 350);
		} else {
			error.value = result.message || 'Registration failed';
		}
	} catch (err) {
		error.value = err?.message || 'Registration failed';
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<div class="w-full max-w-md bg-white rounded-lg shadow-md p-8">
		<div class="sm:mx-auto sm:w-full sm:max-w-sm">
			<h2 class="text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">Create a new account</h2>
		</div>

		<div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
			<form class="space-y-6" action="#" method="POST" @submit="onSubmit">
				<div>
					<label for="name" class="block text-sm font-medium leading-6 text-gray-900"> Full Name </label>
					<div class="mt-2">
						<input
							id="name"
							v-model="fullName"
							name="name"
							type="text"
							autocomplete="name"
							required
							:class="[
								'block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
								fieldErrors.fullName
									? 'ring-red-500 focus:ring-red-600'
									: 'ring-gray-300 focus:ring-indigo-600',
							]"
						/>
					</div>
					<p v-if="fieldErrors.fullName" class="mt-2 text-sm text-red-600">{{ fieldErrors.fullName }}</p>
				</div>

				<div>
					<label for="email" class="block text-sm font-medium leading-6 text-gray-900"> Email address </label>
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
					<label for="phone" class="block text-sm font-medium leading-6 text-gray-900"> Phone number </label>
					<div class="mt-2">
						<input
							id="phone"
							v-model="phone"
							name="phone"
							type="tel"
							autocomplete="tel"
							required
							:class="[
								'block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
								fieldErrors.phone
									? 'ring-red-500 focus:ring-red-600'
									: 'ring-gray-300 focus:ring-indigo-600',
							]"
						/>
					</div>
					<p v-if="fieldErrors.phone" class="mt-2 text-sm text-red-600">{{ fieldErrors.phone }}</p>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium leading-6 text-gray-900"> Password </label>
					<div class="mt-2">
						<input
							id="password"
							v-model="password"
							name="password"
							type="password"
							autocomplete="new-password"
							required
							:class="[
								'block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
								fieldErrors.password
									? 'ring-red-500 focus:ring-red-600'
									: 'ring-gray-300 focus:ring-indigo-600',
							]"
						/>
					</div>
					<p v-if="!fieldErrors.password" class="mt-2 text-xs text-gray-500">
						Password must be at least 6 characters.
					</p>
					<p v-if="fieldErrors.password" class="mt-2 text-sm text-red-600">{{ fieldErrors.password }}</p>
				</div>

				<div>
					<button
						type="submit"
						:disabled="loading"
						:class="[
							'flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
							loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500',
							!loading && !isFormValid ? 'opacity-90' : '',
						]"
					>
						{{ loading ? 'Signing up…' : 'Sign up' }}
					</button>
				</div>
			</form>

			<p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
			<p v-if="success" class="mt-4 text-sm text-green-600">{{ success }}</p>

			<p class="mt-10 text-center text-sm text-gray-500">
				Already have an account?
				<button
					type="button"
					class="font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
					@click="emit('switch')"
				>
					Sign in
				</button>
			</p>
		</div>
	</div>
</template>
