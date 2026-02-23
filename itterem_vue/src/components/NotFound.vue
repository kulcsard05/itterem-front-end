<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
	<div class="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
		<h1 class="text-8xl font-bold text-gray-200">404</h1>
		<h2 class="mt-4 text-2xl font-bold tracking-tight text-gray-900">Az oldal nem található</h2>
		<p class="mt-2 text-sm text-gray-600">A keresett oldal nem létezik vagy eltávolításra került.</p>
		<button
			type="button"
			class="mt-8 inline-flex items-center justify-center rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
			@click="router.push({ name: 'menu' })"
		>
			Vissza az étlaphoz
		</button>
	</div>
</template>
