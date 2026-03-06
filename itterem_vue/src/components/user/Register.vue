<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { register } from '../../api.js';
import { isValidEmail, isValidPhone } from '../../utils.js';
import { PASSWORD_MIN_LENGTH } from '../../constants.js';

const emit = defineEmits(['switch']);
const { t } = useI18n();

const fullName = ref('');
const email = ref('');
const phone = ref('');
const password = ref('');

const loading = ref(false);
const error = ref('');
const success = ref('');
let switchTimer = null;
const fieldErrors = ref({ fullName: '', email: '', phone: '', password: '' });
const submitAttempted = ref(false);

function validate() {
	const next = { fullName: '', email: '', phone: '', password: '' };
	const fullNameValue = fullName.value.trim();
	const emailValue = email.value.trim();
	const phoneValue = phone.value.trim();
	const passwordValue = password.value;

	if (!fullNameValue) next.fullName = t('auth.register.validation.fullNameRequired');
	else if (fullNameValue.length < 2) next.fullName = t('auth.register.validation.fullNameShort');

	if (!emailValue) next.email = t('auth.register.validation.emailRequired');
	else if (!isValidEmail(emailValue)) next.email = t('auth.register.validation.emailInvalid');

	if (!phoneValue) next.phone = t('auth.register.validation.phoneRequired');
	else if (!isValidPhone(phoneValue)) next.phone = t('auth.register.validation.phoneInvalid');

	if (!passwordValue) next.password = t('auth.register.validation.passwordRequired');
	else if (passwordValue.length < PASSWORD_MIN_LENGTH) next.password = t('auth.register.validation.passwordMin', { min: PASSWORD_MIN_LENGTH });

	fieldErrors.value = next;
	return !next.fullName && !next.email && !next.phone && !next.password;
}

const isFormValid = computed(() => {
	const fullNameValue = fullName.value.trim();
	const emailValue = email.value.trim();
	const phoneValue = phone.value.trim();
	const passwordValue = password.value;
	return (
		fullNameValue.length >= 2 && isValidEmail(emailValue) && isValidPhone(phoneValue) && passwordValue.length >= PASSWORD_MIN_LENGTH
	);
});

watch([fullName, email, phone, password], () => {
	if (!submitAttempted.value) return;
	validate();
});

async function onSubmit() {
	error.value = '';
	success.value = '';
	submitAttempted.value = true;

	if (!validate()) {
		error.value = t('auth.register.fixFields');
		return;
	}
	loading.value = true;
	const trimmedFullName = fullName.value.trim();
	const trimmedEmail = email.value.trim();
	const trimmedPhone = phone.value.trim();

	try {
		await register({
			teljesNev: trimmedFullName,
			email: trimmedEmail,
			password: password.value,
			telefonSzam: trimmedPhone,
		});

		success.value = t('auth.register.success');
		fullName.value = '';
		email.value = '';
		phone.value = '';
		password.value = '';
		submitAttempted.value = false;
		fieldErrors.value = { fullName: '', email: '', phone: '', password: '' };
		clearTimeout(switchTimer);
		switchTimer = setTimeout(() => emit('switch'), 350);
	} catch (err) {
		error.value = err?.message || t('auth.register.failed');
	} finally {
		loading.value = false;
	}
}

onUnmounted(() => clearTimeout(switchTimer));
</script>

<template>
	<div class="w-full max-w-md bg-white rounded-lg shadow-md p-8">
		<div class="sm:mx-auto sm:w-full sm:max-w-sm">
			<h2 class="text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">{{ t('auth.register.title') }}</h2>
		</div>

		<div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
			<form class="space-y-6" @submit.prevent="onSubmit">
				<div>
					<label for="name" class="block text-sm font-medium leading-6 text-gray-900"> {{ t('auth.register.fullNameLabel') }} </label>
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
					<label for="email" class="block text-sm font-medium leading-6 text-gray-900"> {{ t('auth.register.emailLabel') }} </label>
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
					<label for="phone" class="block text-sm font-medium leading-6 text-gray-900"> {{ t('auth.register.phoneLabel') }} </label>
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
					<label for="password" class="block text-sm font-medium leading-6 text-gray-900"> {{ t('auth.register.passwordLabel') }} </label>
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
						{{ t('auth.register.passwordHint', { min: PASSWORD_MIN_LENGTH }) }}
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
						{{ loading ? t('auth.register.submitting') : t('auth.register.submit') }}
					</button>
				</div>
			</form>

			<p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
			<p v-if="success" class="mt-4 text-sm text-green-600">{{ success }}</p>

			<p class="mt-10 text-center text-sm text-gray-500">
				{{ t('auth.register.haveAccount') }}
				<button
					type="button"
					class="font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
					@click="emit('switch')"
				>
					{{ t('auth.register.loginNow') }}
				</button>
			</p>
		</div>
	</div>
</template>
