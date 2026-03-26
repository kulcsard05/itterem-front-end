from __future__ import annotations

from dataclasses import asdict, dataclass
import asyncio
from datetime import datetime, timezone
from typing import Callable

from cache import load_cache, save_cache
from config import Settings
from network import enumerate_candidate_networks, prioritize_hosts
from verifier import verify_backend_url


ProgressCallback = Callable[[dict[str, object]], None]


class DiscoveryError(RuntimeError):
	"""Raised when no suitable backend can be found."""


@dataclass(frozen=True)
class DiscoveryResult:
	baseUrl: str
	verifiedPath: str
	statusCode: int
	source: str
	discoveredAt: str

	def to_dict(self) -> dict[str, object]:
		return asdict(self)



def _now_iso() -> str:
	return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


async def _probe_tcp_port(host: str, port: int, timeout_seconds: float) -> bool:
	try:
		reader, writer = await asyncio.wait_for(asyncio.open_connection(host=host, port=port), timeout=timeout_seconds)
	except (TimeoutError, OSError):
		return False
	else:
		writer.close()
		await writer.wait_closed()
		return True


async def _discover_from_hosts(
	hosts: list[str],
	settings: Settings,
	on_progress: ProgressCallback | None,
) -> DiscoveryResult | None:
	semaphore = asyncio.Semaphore(settings.max_concurrency)
	scan_state = {'scanned': 0, 'total': len(hosts)}
	if on_progress is not None:
		on_progress({'phase': 'scanning', 'scanned': 0, 'total': len(hosts)})

	async def probe(host: str) -> DiscoveryResult | None:
		async with semaphore:
			is_open = await _probe_tcp_port(host, settings.backend_port, settings.tcp_timeout_seconds)
			scan_state['scanned'] += 1
			if on_progress is not None:
				on_progress({
					'phase': 'probing',
					'host': host,
					'scanned': scan_state['scanned'],
					'total': scan_state['total'],
				})
			if not is_open:
				return None

			base_url = f'http://{host}:{settings.backend_port}'
			verified = await asyncio.to_thread(verify_backend_url, base_url, settings)
			if verified is None:
				return None

			return DiscoveryResult(
				baseUrl=verified['baseUrl'],
				verifiedPath=str(verified['verifiedPath']),
				statusCode=int(verified['statusCode']),
				source='scan',
				discoveredAt=_now_iso(),
			)

	tasks = [asyncio.create_task(probe(host)) for host in hosts]
	try:
		for completed in asyncio.as_completed(tasks, timeout=settings.scan_timeout_seconds):
			result = await completed
			if result is None:
				continue
			for task in tasks:
				if not task.done():
					task.cancel()
			await asyncio.gather(*tasks, return_exceptions=True)
			return result
	except TimeoutError:
		return None
	finally:
		for task in tasks:
			if not task.done():
				task.cancel()
		await asyncio.gather(*tasks, return_exceptions=True)

	return None


async def _discover_from_localhost(settings: Settings, on_progress: ProgressCallback | None) -> DiscoveryResult | None:
	localhost_candidates = ['localhost', '127.0.0.1']
	for host in localhost_candidates:
		if on_progress is not None:
			on_progress({'phase': 'verifying-localhost', 'host': host})
		base_url = f'http://{host}:{settings.backend_port}'
		verified = await asyncio.to_thread(verify_backend_url, base_url, settings)
		if verified is None:
			continue
		return DiscoveryResult(
			baseUrl=str(verified['baseUrl']),
			verifiedPath=str(verified['verifiedPath']),
			statusCode=int(verified['statusCode']),
			source='localhost',
			discoveredAt=_now_iso(),
		)
	return None


async def discover_backend(
	settings: Settings,
	on_progress: ProgressCallback | None = None,
	override_url: str | None = None,
) -> DiscoveryResult:
	if override_url:
		verified = await asyncio.to_thread(verify_backend_url, override_url, settings)
		if verified is None:
			raise DiscoveryError(f'Manual override failed verification: {override_url}')
		result = DiscoveryResult(
			baseUrl=str(verified['baseUrl']),
			verifiedPath=str(verified['verifiedPath']),
			statusCode=int(verified['statusCode']),
			source='override',
			discoveredAt=_now_iso(),
		)
		save_cache(settings.cache_path, {'lastResult': result.to_dict(), 'overrideUrl': override_url})
		return result

	cache_payload = load_cache(settings.cache_path)
	cached_result = cache_payload.get('lastResult') if isinstance(cache_payload, dict) else None
	cached_url = cached_result.get('baseUrl') if isinstance(cached_result, dict) else None
	if isinstance(cached_url, str) and cached_url:
		if on_progress is not None:
			on_progress({'phase': 'verifying-cache', 'baseUrl': cached_url})
		verified_cached = await asyncio.to_thread(verify_backend_url, cached_url, settings)
		if verified_cached is not None:
			result = DiscoveryResult(
				baseUrl=str(verified_cached['baseUrl']),
				verifiedPath=str(verified_cached['verifiedPath']),
				statusCode=int(verified_cached['statusCode']),
				source='cache',
				discoveredAt=_now_iso(),
			)
			save_cache(settings.cache_path, {'lastResult': result.to_dict()})
			return result

	localhost_result = await _discover_from_localhost(settings, on_progress)
	if localhost_result is not None:
		save_cache(settings.cache_path, {'lastResult': localhost_result.to_dict()})
		return localhost_result

	if on_progress is not None:
		on_progress({'phase': 'enumerating-networks'})
	candidate_networks = await asyncio.to_thread(enumerate_candidate_networks)
	if not candidate_networks:
		raise DiscoveryError('No active IPv4 networks were found for discovery.')

	cached_ip = None
	if isinstance(cached_url, str) and cached_url.startswith('http://'):
		cached_ip = cached_url.split('://', 1)[1].split(':', 1)[0]

	hosts = prioritize_hosts(candidate_networks, cached_ip, settings.max_hosts_per_network)
	if not hosts:
		raise DiscoveryError('No candidate hosts were produced from the local networks.')

	if on_progress is not None:
		on_progress({'phase': 'scanning', 'hostCount': len(hosts), 'networkCount': len(candidate_networks), 'scanned': 0, 'total': len(hosts)})
	result = await _discover_from_hosts(hosts, settings, on_progress)
	if result is None:
		raise DiscoveryError('No verified Itterem backend was found on the local networks.')

	save_cache(settings.cache_path, {'lastResult': result.to_dict()})
	return result
