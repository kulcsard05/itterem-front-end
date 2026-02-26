<template>
	<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
		<!-- Hero -->
		<section class="mb-16 text-center">
			<h1 class="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">Rólunk</h1>
			<p class="mx-auto max-w-2xl text-lg text-gray-600">
				Az Itterem egy szívből jövő projekt/étterem – ahol a jó ételek, a barátságos kiszolgálás és az otthoni hangulat találkozik.
			</p>
		</section>

		<!-- Story + values grid -->
		<section class="mb-16 grid gap-8 md:grid-cols-2">
			<div class="rounded-2xl bg-indigo-50 p-8">
				<h2 class="mb-3 text-2xl font-bold text-indigo-900">A mi történetünk</h2>
				<p class="mb-4 text-gray-700 leading-relaxed">
					Az Itterem 2018-ban nyitotta meg kapuit egy kis belváosi sarokhelyen. Alapítóink, Kovács Péter és Nagy Erzsébet
					mindig is hittek abban, hogy az egyszerű, jó minőségű alapanyagokból készült ételek a legfinomabbak.
				</p>
				<p class="text-gray-700 leading-relaxed">
					Ma már több mint <strong>200 törzsvásárlónk</strong> van, és minden nap azzal a céllal nyitjuk ki az ajtókat,
					hogy valami finomat tegyünk az asztalra – szívvel-lélekkel.
				</p>
			</div>

			<div class="rounded-2xl bg-gray-50 p-8">
				<h2 class="mb-3 text-2xl font-bold text-gray-900">Értékeink</h2>
				<ul class="space-y-4">
					<li class="flex items-start gap-3">
						<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">1</span>
						<div>
							<p class="font-semibold text-gray-900">Frissesség és minőség</p>
							<p class="text-sm text-gray-600">Naponta friss alapanyagokból, helyi termelőktől dolgozunk.</p>
						</div>
					</li>
					<li class="flex items-start gap-3">
						<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">2</span>
						<div>
							<p class="font-semibold text-gray-900">Vendégközpontúság</p>
							<p class="text-sm text-gray-600">Minden vendégünkre személyes figyelmet fordítunk.</p>
						</div>
					</li>
					<li class="flex items-start gap-3">
						<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">3</span>
						<div>
							<p class="font-semibold text-gray-900">Fenntarthatóság</p>
							<p class="text-sm text-gray-600">Csomagolásaink újrahasznosíthatók, hulladékot tudatosan csökkentünk.</p>
						</div>
					</li>
				</ul>
			</div>
		</section>

		<!-- Team section -->
		<section class="mb-16">
			<h2 class="mb-8 text-center text-2xl font-bold text-gray-900">Csapatunk</h2>
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

<script setup>
const team = Object.freeze([
	{
		name: 'Kovács Péter',
		role: 'Alapító & Séf',
		emoji: '👨‍🍳',
		bio: '15 éves tapasztalattal rendelkező séf, aki imád kísérletezni az ízekkel.',
	},
	{
		name: 'Nagy Erzsébet',
		role: 'Alapító & Manager',
		emoji: '👩‍💼',
		bio: 'A vendéglátás szerelmese, aki minden nap gondoskodik arról, hogy minden zökkenőmentesen menjen.',
	},
	{
		name: 'Tóth Dávid',
		role: 'Cukrász',
		emoji: '🍰',
		bio: 'Egyedi desszertjeivel minden látogatást emlékezetessé tesz.',
	},
]);
</script>