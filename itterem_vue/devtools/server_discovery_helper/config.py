from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import platform


def _default_cache_path() -> Path:
	if platform.system() == 'Windows':
		root = Path(os.environ.get('LOCALAPPDATA') or Path.home() / 'AppData' / 'Local')
		return root / 'Itterem' / 'server-discovery-helper.json'
	root = Path(os.environ.get('XDG_CACHE_HOME') or Path.home() / '.cache')
	return root / 'itterem' / 'server-discovery-helper.json'


def _split_paths(raw: str) -> tuple[str, ...]:
	parts = [part.strip() for part in raw.split(',')]
	return tuple(part for part in parts if part)


@dataclass(frozen=True)
class Settings:
	helper_host: str = '127.0.0.1'
	helper_port: int = 41721
	backend_port: int = 7200
	tcp_timeout_seconds: float = 0.35
	verify_timeout_seconds: float = 2.5
	scan_timeout_seconds: float = 30.0
	max_concurrency: int = 128
	max_hosts_per_network: int = 512
	verify_paths: tuple[str, ...] = ('/api/health', '/api/meta', '/api/Kategoria', '/api/Keszetelek')
	cache_path: Path = _default_cache_path()

	@classmethod
	def from_env(cls) -> 'Settings':
		verify_paths = _split_paths(
			os.environ.get(
				'ITTEREM_DISCOVERY_VERIFY_PATHS',
				'/api/health,/api/meta,/api/Kategoria,/api/Keszetelek',
			),
		)
		return cls(
			helper_host=os.environ.get('ITTEREM_DISCOVERY_HELPER_HOST', '127.0.0.1'),
			helper_port=int(os.environ.get('ITTEREM_DISCOVERY_HELPER_PORT', '41721')),
			backend_port=int(os.environ.get('ITTEREM_DISCOVERY_BACKEND_PORT', '7200')),
			tcp_timeout_seconds=float(os.environ.get('ITTEREM_DISCOVERY_TCP_TIMEOUT_SECONDS', '0.35')),
			verify_timeout_seconds=float(os.environ.get('ITTEREM_DISCOVERY_VERIFY_TIMEOUT_SECONDS', '2.5')),
			scan_timeout_seconds=float(os.environ.get('ITTEREM_DISCOVERY_SCAN_TIMEOUT_SECONDS', '30')),
			max_concurrency=int(os.environ.get('ITTEREM_DISCOVERY_MAX_CONCURRENCY', '128')),
			max_hosts_per_network=int(os.environ.get('ITTEREM_DISCOVERY_MAX_HOSTS_PER_NETWORK', '512')),
			verify_paths=verify_paths or ('/api/Kategoria',),
			cache_path=Path(os.environ.get('ITTEREM_DISCOVERY_CACHE_PATH', _default_cache_path())),
		)
