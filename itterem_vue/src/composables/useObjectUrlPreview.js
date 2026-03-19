import { computed, onUnmounted, ref } from 'vue';

export function useObjectUrlPreview(initialUrlRef = null) {
	const previewUrl = ref('');

	function clearPreviewUrl() {
		if (previewUrl.value) {
			URL.revokeObjectURL(previewUrl.value);
			previewUrl.value = '';
		}
	}

	function setPreviewFile(file) {
		clearPreviewUrl();
		if (file instanceof File) {
			previewUrl.value = URL.createObjectURL(file);
		}
	}

	const displayedPreviewUrl = computed(() => {
		if (previewUrl.value) return previewUrl.value;
		return String(initialUrlRef?.value ?? '').trim();
	});

	onUnmounted(() => {
		clearPreviewUrl();
	});

	return {
		previewUrl,
		displayedPreviewUrl,
		setPreviewFile,
		clearPreviewUrl,
	};
}
