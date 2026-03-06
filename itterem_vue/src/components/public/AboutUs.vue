<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const team = computed(() => [
	{
		name: 'Kovács Péter',
		role: t('about.team.peter.role'),
		emoji: '👨‍🍳',
		bio: t('about.team.peter.bio'),
	},
	{
		name: 'Nagy Erzsébet',
		role: t('about.team.erzsebet.role'),
		emoji: '👩‍💼',
		bio: t('about.team.erzsebet.bio'),
	},
	{
		name: 'Tóth Dávid',
		role: t('about.team.david.role'),
		emoji: '🍰',
		bio: t('about.team.david.bio'),
	},
]);
</script>

<template>
	<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
		<!-- Hero -->
		<section class="mb-16 text-center">
			<h1 class="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">{{ t('about.title') }}</h1>
			<p class="mx-auto max-w-2xl text-lg text-gray-600">
				{{ t('about.subtitle') }}
			</p>
		</section>

		<!-- Story + values grid -->
		<section class="mb-16 grid gap-8 md:grid-cols-2">
			<div class="rounded-2xl bg-indigo-50 p-8">
				<h2 class="mb-3 text-2xl font-bold text-indigo-900">{{ t('about.storyTitle') }}</h2>
				<p class="mb-4 text-gray-700 leading-relaxed">
					{{ t('about.storyParagraph1') }}
				</p>
				<p class="text-gray-700 leading-relaxed">
					{{ t('about.storyParagraph2') }}
				</p>
			</div>

			<div class="rounded-2xl bg-gray-50 p-8">
				<h2 class="mb-3 text-2xl font-bold text-gray-900">{{ t('about.valuesTitle') }}</h2>
				<ul class="space-y-4">
					<li class="flex items-start gap-3">
						<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">1</span>
						<div>
							<p class="font-semibold text-gray-900">{{ t('about.values.freshness.title') }}</p>
							<p class="text-sm text-gray-600">{{ t('about.values.freshness.body') }}</p>
						</div>
					</li>
					<li class="flex items-start gap-3">
						<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">2</span>
						<div>
							<p class="font-semibold text-gray-900">{{ t('about.values.hospitality.title') }}</p>
							<p class="text-sm text-gray-600">{{ t('about.values.hospitality.body') }}</p>
						</div>
					</li>
					<li class="flex items-start gap-3">
						<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">3</span>
						<div>
							<p class="font-semibold text-gray-900">{{ t('about.values.sustainability.title') }}</p>
							<p class="text-sm text-gray-600">{{ t('about.values.sustainability.body') }}</p>
						</div>
					</li>
				</ul>
			</div>
		</section>

		<!-- Team section -->
		<section class="mb-16">
			<h2 class="mb-8 text-center text-2xl font-bold text-gray-900">{{ t('about.teamTitle') }}</h2>
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				<div v-for="member in team" :key="member.name" class="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
					<div class="mb-4 flex items-center justify-center">
						<div class="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-3xl">
							{{ member.emoji }}
						</div>
					</div>
					<h3 class="font-bold text-gray-900">{{ member.name }}</h3>
					<p class="text-sm font-medium text-indigo-600">{{ member.role }}</p>
					<p class="mt-2 text-sm text-gray-500">{{ member.bio }}</p>
				</div>
			</div>
		</section>
	</div>
</template>