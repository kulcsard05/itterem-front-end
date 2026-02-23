<script setup>
import { computed, ref, watch } from 'vue';
import Login from './Login.vue';
import Register from './Register.vue';
import { updatePhone } from '../api.js';
import { isValidPhone, parseJwt } from '../utils.js';

const props = defineProps({
	auth: { type: Object, default: null },
});

const emit = defineEmits(['login-success', 'logout']);

const currentForm = ref('login');
const isEditingPhone = ref(false);
const phoneInput = ref('');
const phoneError = ref('');
const phoneSuccess = ref('');
const phoneSaving = ref(false);

function getPhoneFromAuth(auth) {
	if (!auth) return '';
	return String(auth.telefonszam ?? '').trim();
}

const currentPhone = computed(() => getPhoneFromAuth(props.auth));

watch(
	() => props.auth,
	(next) => {
		if (!isEditingPhone.value) {
			phoneInput.value = getPhoneFromAuth(next);
		}
	},
	{ immediate: true, deep: true },
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

async function savePhone() {
	phoneError.value = '';
	phoneSuccess.value = '';

	const nextPhone = phoneInput.value.trim();
	if (!isValidPhone(nextPhone)) {
		phoneError.value = 'Kérjük, adj meg egy érvényes telefonszámot.';
		return;
	}

	const decodedToken = parseJwt(props.auth?.token);
	const userId = props.auth?.id ?? props.auth?.sub ?? decodedToken?.sub ?? decodedToken?.id;
	if (!userId) {
		phoneError.value = 'Felhasználó azonosító nem található.';
		return;
	}

	phoneSaving.value = true;

	try {
		const result = await updatePhone({ id: userId, telefonszam: nextPhone });

		if (!result.ok) {
			phoneError.value = result.message || 'Telefonszám frissítése sikertelen.';
			return;
		}

		const updatedUser = {
			...(props.auth || {}),
			telefonszam: nextPhone,
		};

		try {
			localStorage.setItem('auth', JSON.stringify(updatedUser));
		} catch {
			// ignore storage errors
		}

		emit('login-success', updatedUser);
		isEditingPhone.value = false;
		phoneSuccess.value = 'Telefonszám mentve.';
	} catch (err) {
		phoneError.value = err?.message || 'Telefonszám frissítése sikertelen.';
	} finally {
		phoneSaving.value = false;
	}
}

function toggleForm() {
	currentForm.value = currentForm.value === 'login' ? 'register' : 'login';
}
</script>

<template>
	<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
		<h1 class="text-2xl font-bold tracking-tight text-gray-900">Fiókom</h1>

		<div
			v-if="props.auth && props.auth.token"
			class="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
		>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<div class="text-sm text-gray-600">Bejelentkezve mint</div>
					<div class="mt-1 text-lg font-semibold text-gray-900">{{ props.auth.teljesNev || '-' }}</div>
					<div class="mt-1 text-sm text-gray-700">{{ props.auth.email || '-' }}</div>

					<div class="mt-4">
						<div class="text-sm text-gray-600">Telefonszám</div>

						<div v-if="!isEditingPhone" class="mt-1 flex items-center gap-3">
							<div class="text-sm text-gray-900">{{ currentPhone || '-' }}</div>
							<button
								type="button"
								class="rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
								@click="startPhoneEdit"
							>
								Szerkesztés
							</button>
						</div>

						<div v-else class="mt-2 flex flex-wrap items-start gap-2">
							<input
								v-model="phoneInput"
								type="tel"
								autocomplete="tel"
								:disabled="phoneSaving"
								class="w-full max-w-xs rounded-md border-0 px-3 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 disabled:opacity-50"
							/>
							<button
								type="button"
								:disabled="phoneSaving"
								class="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
								@click="savePhone"
							>
								{{ phoneSaving ? 'Mentés…' : 'Mentés' }}
							</button>
							<button
								type="button"
								:disabled="phoneSaving"
								class="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
								@click="cancelPhoneEdit"
							>
								Mégse
							</button>
						</div>

						<p v-if="phoneError" class="mt-2 text-sm text-red-600">{{ phoneError }}</p>
						<p v-else-if="phoneSuccess" class="mt-2 text-sm text-green-600">{{ phoneSuccess }}</p>
					</div>
				</div>

				<button
					type="button"
					class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
					@click="emit('logout')"
				>
					Kijelentkezés
				</button>
			</div>

			<div class="mt-6 text-sm text-gray-600">
				Ez a felhasználói oldalad. Később bővítheted rendelésekkel, kedvencekkel stb.
			</div>
		</div>

		<div v-else class="mt-8 flex justify-center">
			<Login
				v-if="currentForm === 'login'"
				@switch="toggleForm"
				@login-success="(user) => emit('login-success', user)"
			/>
			<Register v-else @switch="toggleForm" />
		</div>
	</div>
</template>
