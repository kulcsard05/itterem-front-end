function parseSseEventBlock(block) {
	const lines = String(block ?? '').split(/\r?\n/);
	let event = '';
	let data = '';
	for (const line of lines) {
		if (!line) continue;
		if (line.startsWith(':')) continue;
		if (line.startsWith('event:')) {
			const value = line.slice(6);
			event = String(value.startsWith(' ') ? value.slice(1) : value).trim();
			continue;
		}
		if (line.startsWith('data:')) {
			const value = line.slice(5);
			data += `${value.startsWith(' ') ? value.slice(1) : value}\n`;
		}
	}
	if (data.endsWith('\n')) data = data.slice(0, -1);
	return { data, event };
}

export async function startFetchSse({ url, token, onOpen, onMessage, onError, onController }) {
	const controller = new AbortController();
	onController?.(controller);

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				accept: 'text/event-stream',
				Authorization: `Bearer ${token}`,
			},
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(`SSE HTTP hiba: ${response.status}`);
		}

		if (!response.body) {
			throw new Error('SSE válasz body hiányzik.');
		}

		onOpen?.();

		const reader = response.body.getReader();
		const decoder = new TextDecoder('utf-8');
		let buffer = '';

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			const chunk = decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
			buffer += chunk;

			let idx;
			while ((idx = buffer.indexOf('\n\n')) !== -1) {
				const rawBlock = buffer.slice(0, idx);
				buffer = buffer.slice(idx + 2);
				const evt = parseSseEventBlock(rawBlock);
				onMessage?.(evt);
			}
		}
	} catch (err) {
		if (controller.signal.aborted) return;
		onError?.(err);
	}
}
