import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const helperEntry = path.join(projectRoot, 'devtools', 'server_discovery_helper', 'main.py');

const helperHost = process.env.ITTEREM_DISCOVERY_HELPER_HOST || '127.0.0.1';
const helperPort = Number(process.env.ITTEREM_DISCOVERY_HELPER_PORT || 41721);
const helperBaseUrl = `http://${helperHost}:${helperPort}`;
const helperStartupTimeoutMs = Number(process.env.ITTEREM_DISCOVERY_HELPER_STARTUP_TIMEOUT_MS || 10_000);
const discoveryTimeoutMs = Number(process.env.ITTEREM_DISCOVERY_TIMEOUT_MS || 45_000);
const viteCliArgs = process.argv.slice(2);

let helperProcess = null;
let viteProcess = null;
let shuttingDown = false;

function isWindows() {
	return process.platform === 'win32';
}

function getNpmCommand() {
	return isWindows() ? 'npm.cmd' : 'npm';
}

function parseDotEnv(content) {
	const result = {};
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const eqIndex = line.indexOf('=');
		if (eqIndex === -1) continue;
		const key = line.slice(0, eqIndex).trim();
		let value = line.slice(eqIndex + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		result[key] = value;
	}
	return result;
}

async function readLocalEnvFile() {
	const envPath = path.join(projectRoot, '.env');
	if (!existsSync(envPath)) return {};
	const content = await readFile(envPath, 'utf8');
	return parseDotEnv(content);
}

function resolvePythonCommand() {
	const explicit = process.env.ITTEREM_DISCOVERY_PYTHON;
	const candidates = explicit
		? [{ command: explicit, args: [] }]
		: isWindows()
			? [
				{ command: 'py', args: ['-3'] },
				{ command: 'python', args: [] },
			]
			: [
				{ command: 'python3', args: [] },
				{ command: 'python', args: [] },
			];

	for (const candidate of candidates) {
		const probe = spawnSync(candidate.command, [...candidate.args, '--version'], { stdio: 'ignore' });
		if (probe.status === 0) return candidate;
	}

	throw new Error(
		'Python 3 was not found. Install Python or set ITTEREM_DISCOVERY_PYTHON to a valid executable.',
	);
}

async function fetchJson(url, options = {}) {
	const response = await fetch(url, options);
	const text = await response.text();
	let body = null;
	if (text) {
		try {
			body = JSON.parse(text);
		} catch {
			body = { raw: text };
		}
	}

	if (!response.ok) {
		const message = body?.error || body?.message || `HTTP ${response.status}`;
		throw new Error(message);
	}

	return body;
}

async function waitForHelperReady(timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	let lastError = null;

	while (Date.now() < deadline) {
		try {
			await fetchJson(`${helperBaseUrl}/status`);
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	}

	throw lastError || new Error('The discovery helper did not become ready in time.');
}

async function isHelperReady() {
	try {
		await fetchJson(`${helperBaseUrl}/status`);
		return true;
	} catch {
		return false;
	}
}

async function requestDiscovery() {
	await fetchJson(`${helperBaseUrl}/discover`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ trigger: 'dev-launcher' }),
	});
}

async function waitForDiscoveryResult(timeoutMs) {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const payload = await fetchJson(`${helperBaseUrl}/result`);
		if (payload?.status === 'found' && payload?.result?.baseUrl) {
			return payload.result.baseUrl;
		}
		if (payload?.status === 'error') {
			throw new Error(payload.error || 'Backend discovery failed.');
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error('Timed out while waiting for backend discovery.');
}

function spawnHelper() {
	const python = resolvePythonCommand();
	const args = [
		...python.args,
		helperEntry,
		'serve',
		'--host',
		helperHost,
		'--port',
		String(helperPort),
	];

	helperProcess = spawn(python.command, args, {
		cwd: projectRoot,
		stdio: 'inherit',
		env: {
			...process.env,
			ITTEREM_DISCOVERY_HELPER_HOST: helperHost,
			ITTEREM_DISCOVERY_HELPER_PORT: String(helperPort),
		},
	});

	helperProcess.on('exit', (code) => {
		if (!shuttingDown && code !== 0) {
			console.error(`[discovery] Helper exited unexpectedly with code ${code}.`);
		}
	});
	return helperProcess;
}

function killChild(child, signal = 'SIGTERM') {
	if (!child || child.exitCode !== null || child.killed) return;
	child.kill(signal);
}

async function cleanupAndExit(exitCode = 0) {
	if (shuttingDown) return;
	shuttingDown = true;
	killChild(viteProcess);
	killChild(helperProcess);
	setTimeout(() => {
		killChild(viteProcess, 'SIGKILL');
		killChild(helperProcess, 'SIGKILL');
	}, 2_000);
	process.exit(exitCode);
}

function launchVite(targetUrl) {
	const npmCommand = getNpmCommand();
	const npmArgs = ['run', 'dev:raw'];
	if (viteCliArgs.length > 0) {
		npmArgs.push('--', ...viteCliArgs);
	}

	viteProcess = spawn(npmCommand, npmArgs, {
		cwd: projectRoot,
		stdio: 'inherit',
		env: {
			...process.env,
			VITE_API_BASE_URL: targetUrl,
			VITE_DISCOVERY_HELPER_HOST: helperHost,
			VITE_DISCOVERY_HELPER_PORT: String(helperPort),
		},
	});

	viteProcess.on('exit', (code) => {
		cleanupAndExit(code ?? 0);
	});
}

async function resolveBackendTarget() {
	const localEnv = await readLocalEnvFile();
	const fallbackTarget = process.env.VITE_API_BASE_URL || localEnv.VITE_API_BASE_URL || '';

	if (process.env.ITTEREM_DISCOVERY_SKIP === '1') {
		if (!fallbackTarget) {
			throw new Error('Discovery was skipped but no VITE_API_BASE_URL fallback is configured.');
		}
		return fallbackTarget;
	}

	if (await isHelperReady()) {
		console.log(`[discovery] Reusing existing helper at ${helperBaseUrl}`);
	} else {
		spawnHelper();
		await waitForHelperReady(helperStartupTimeoutMs);
	}
	await requestDiscovery();

	try {
		return await waitForDiscoveryResult(discoveryTimeoutMs);
	} catch (error) {
		if (fallbackTarget) {
			console.warn(`[discovery] ${error.message}`);
			console.warn(`[discovery] Falling back to configured VITE_API_BASE_URL=${fallbackTarget}`);
			return fallbackTarget;
		}
		throw error;
	}
}

async function main() {
	if (!existsSync(helperEntry)) {
		throw new Error(`Discovery helper entrypoint not found: ${helperEntry}`);
	}

	process.on('SIGINT', () => cleanupAndExit(130));
	process.on('SIGTERM', () => cleanupAndExit(143));

	const targetUrl = await resolveBackendTarget();
	console.log(`[discovery] Using backend target ${targetUrl}`);
	launchVite(targetUrl);
}

main().catch(async (error) => {
	console.error(`[discovery] ${error.message}`);
	await cleanupAndExit(1);
});
