<script setup>
import { useI18n } from 'vue-i18n';

const currentYear = new Date().getFullYear();
const { t } = useI18n();
</script>

<template>
	<footer class="mt-auto border-t border-gray-200 bg-gray-50">
		<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
			<div class="grid gap-10 md:grid-cols-2 lg:grid-cols-3">

				<!-- Brand & description -->
				<div>
					<p class="text-lg font-bold text-gray-900">{{ t('common.appName') }}</p>
					<p class="mt-2 text-sm text-gray-500 leading-relaxed">
						{{ t('footer.tagline') }}
					</p>
				</div>

				<!-- Contact info -->
				<div>
					<p class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-900">{{ t('footer.contact') }}</p>
					<ul class="space-y-2 text-sm text-gray-600">
						<li class="flex items-start gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							<span>{{ t('footer.address') }}</span>
						</li>
						<li class="flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
							</svg>
							<a href="tel:+3612345678" class="hover:text-indigo-600">+36 1 234 5678</a>
						</li>
						<li class="flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
							<a href="mailto:info@itterem.hu" class="hover:text-indigo-600">info@itterem.hu</a>
						</li>
						<li class="flex items-start gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="whitespace-pre-line">{{ t('footer.hours') }}</span>
						</li>
					</ul>
				</div>

				<!-- Google Maps embed -->
				<div class="md:col-span-2 lg:col-span-1">
					<p class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-900">{{ t('footer.map') }}</p>
					<div class="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
						<iframe
							src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2695.5!2d19.0503!3d47.4984!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4741dc6b7a0b0001%3A0x9e6a7f1e4b2c3d4e!2sV%C3%A1ci%20utca%2C%20Budapest!5e0!3m2!1shu!2shu!4v1700000000000!5m2!1shu!2shu"
							width="100%"
							height="220"
							style="border:0;"
							allowfullscreen
							loading="lazy"
							referrerpolicy="no-referrer-when-downgrade"
							:title="t('footer.mapTitle')"
						></iframe>
					</div>
				</div>

			</div>

			<div class="mt-10 border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
				&copy; {{ currentYear }} {{ t('common.appName') }}. {{ t('footer.copyright') }}
			</div>
		</div>
	</footer>
</template>
