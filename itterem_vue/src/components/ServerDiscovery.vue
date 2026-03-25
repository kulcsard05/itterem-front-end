<!-- 
THIS IS A DEV FEATURE, not in production build!
meant to search backend server on lan with python helper
-->

<script setup>
import { computed, ref } from 'vue';
import { useServerDiscovery } from '../composables/useServerDiscovery.js';

const emit = defineEmits(['close', 'server-changed']);

const { scanning, scanned, total, discoveredUrl, error, scan, stopScan, setManual, clearServer } =
	useServerDiscovery();

const manualInput = ref('');
const manualError = ref('');
const showManual = ref(false);

// 0–100 %
const progress = computed(() =>
	total.value > 0 ? Math.min(100, Math.round((scanned.value / total.value) * 100)) : 0,
);

async function startScan() {
	await scan();
	if (discoveredUrl.value) {
		emit('server-changed', discoveredUrl.value);
	}
}

function handleStop() {
	stopScan();
}

function toggleManual() {
	showManual.value = !showManual.value;
	manualError.value = '';
}

async function applyManual() {
	manualError.value = '';
	const raw = manualInput.value.trim().replace(/\/+$/, '');
	if (!raw) {
		manualError.value = 'Kérjük, add meg a szerver URL-jét.';
		return;
	}
	try {
		new URL(raw);
	} catch {
		manualError.value = 'Érvénytelen formátum – pl. http://192.168.1.50:7200';
		return;
	}
	try {
		const saved = await setManual(raw);
		emit('server-changed', saved);
	} catch (e) {
		manualError.value = e.message || 'A megadott szerver ellenőrzése sikertelen.';
	}
}

async function handleClear() {
	await clearServer();
	manualInput.value = '';
	emit('server-changed', null);
}

function handleClose() {
	if (scanning.value) stopScan();
	emit('close');
}
</script>

<template>
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		@click.self="handleClose"
	>
		<!-- Card -->
		<div class="w-full max-w-md rounded-2xl bg-white shadow-xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
				<h2 class="text-base font-semibold text-gray-900">Fejlesztői szerver keresése</h2>
				<button
					type="button"
					class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
					aria-label="Bezárás"
					@click="handleClose"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>

			<!-- Body -->
			<div class="px-6 py-5 space-y-4">
				<!-- Current server pill -->
				<div v-if="discoveredUrl" class="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2.5 text-sm">
					<span class="h-2 w-2 shrink-0 rounded-full bg-green-500"></span>
					<span class="min-w-0 truncate font-mono text-green-800">{{ discoveredUrl }}</span>
					<button
						type="button"
						class="ml-auto shrink-0 text-xs text-red-500 hover:text-red-700"
						:disabled="scanning"
						@click="handleClear"
					>
						Törlés
					</button>
				</div>
				<p v-else class="rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-500">
					Nincs kiválasztott fejlesztői szerver.
				</p>

				<!-- Scan progress -->
				<div v-if="scanning" class="space-y-2">
					<div class="flex justify-between text-xs text-gray-500">
						<span>Keresés… {{ scanned }}/{{ total }}</span>
						<span>{{ progress }}%</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
						<div
							class="h-full rounded-full bg-indigo-600 transition-all duration-150"
							:style="{ width: progress + '%' }"
						></div>
					</div>
				</div>

				<!-- Error -->
				<p v-if="error" class="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
					{{ error }}
				</p>

				<!-- Action row -->
				<div class="flex gap-2">
					<button
						v-if="!scanning"
						type="button"
						class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
						@click="startScan"
					>
						Automatikus keresés
					</button>
					<button
						v-else
						type="button"
						class="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
						@click="handleStop"
					>
						Megszakítás
					</button>

					<button
						type="button"
						class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
						:disabled="scanning"
						@click="toggleManual"
					>
						Manuális
					</button>
				</div>

				<!-- Manual URL input -->
				<div v-if="showManual" class="space-y-2">
					<label class="block text-xs font-medium text-gray-700">
						Szerver URL
					</label>
					<div class="flex gap-2">
						<input
							v-model="manualInput"
							type="url"
							class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
							placeholder="http://192.168.1.50:7200"
							@keydown.enter="applyManual"
						/>
						<button
							type="button"
							class="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
							@click="applyManual"
						>
							Mentés
						</button>
					</div>
					<p v-if="manualError" class="text-xs text-red-600">{{ manualError }}</p>
				</div>

				<!-- Info note -->
				<p class="text-xs text-gray-400">
					A keresés a helyi discovery helperen keresztül próbálja megtalálni a
					<code class="rounded bg-gray-100 px-1">:{{ 7200 }}</code> porton futó backendet.
					A manuálisan megadott cím is a helperben tárolódik. Ha a Vite proxy már másik célra
					indult, a váltás után indítsd újra az <code class="rounded bg-gray-100 px-1">npm run dev</code>
					parancsot.
				</p>
			</div>
		</div>
	</div>
</template>
