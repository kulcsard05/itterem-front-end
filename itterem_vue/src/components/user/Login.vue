<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { login } from '../../services/api.js';
import { isValidEmail } from '../../shared/utils.js';

const emit = defineEmits(['switch', 'login-success']);
const { t } = useI18n();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const fieldErrors = ref({ email: '', password: '' });
const submitAttempted = ref(false);

function checkFields() {
	const emailValue = email.value.trim();
	const passwordValue = password.value;
	return {
		email: !emailValue
			? t('auth.login.validation.emailRequired')
			: !isValidEmail(emailValue)
				? t('auth.login.validation.emailInvalid')
				: '',
		password: !passwordValue ? t('auth.login.validation.passwordRequired') : '',
	};
}

function validate() {
	const errors = checkFields();
	fieldErrors.value = errors;
	return !errors.email && !errors.password;
}

const canSubmit = computed(() => {
	if (loading.value) return false;
	const errors = checkFields();
	return !errors.email && !errors.password;
});

watch([email, password], () => {
	if (!submitAttempted.value) return;
	validate();
});

async function onSubmit() {
	error.value = '';
	submitAttempted.value = true;

	if (!validate()) {
		error.value = t('auth.login.fixFields');
		return;
	}
	loading.value = true;
	const trimmedEmail = email.value.trim();

	try {
		const user = await login(trimmedEmail, password.value);
		emit('login-success', user);
	} catch (err) {
		error.value = err?.message || t('auth.login.failed');
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<div class="w-full max-w-md bg-white rounded-lg shadow-md p-8">
		<div class="sm:mx-auto sm:w-full sm:max-w-sm">
			<h2 class="text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
				{{ t('auth.login.title') }}
			</h2>
		</div>

		<div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
			<form class="space-y-6" @submit.prevent="onSubmit">
				<div>
					<label for="email" class="block text-sm font-medium leading-6 text-gray-900"> {{ t('auth.login.emailLabel') }} </label>
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
							{{ t('auth.login.passwordLabel') }}
						</label>
						<div class="text-sm">
							<span
								class="font-semibold text-gray-400 cursor-not-allowed"
								:title="t('auth.login.forgotPasswordSoon')"
							>
								{{ t('auth.login.forgotPassword') }}
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
						{{ loading ? t('auth.login.submitting') : t('auth.login.submit') }}
					</button>
				</div>
			</form>

			<p class="mt-10 text-center text-sm text-gray-500">
				{{ t('auth.login.noAccount') }}
				<button
					type="button"
					class="font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
					@click="emit('switch')"
				>
					{{ t('auth.login.registerNow') }}
				</button>
			</p>
		</div>
	</div>
</template>
