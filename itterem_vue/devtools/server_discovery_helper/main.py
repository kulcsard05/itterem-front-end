from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
	sys.path.insert(0, str(CURRENT_DIR))

from api import create_http_server  # noqa: E402
from config import Settings  # noqa: E402
from scanner import DiscoveryError, discover_backend  # noqa: E402


async def _discover_once(settings: Settings, override_url: str | None) -> dict[str, object]:
	result = await discover_backend(settings, override_url=override_url)
	return result.to_dict()

def build_parser() -> argparse.ArgumentParser:
	parser = argparse.ArgumentParser(description='Development-only Itterem backend discovery helper')
	subparsers = parser.add_subparsers(dest='command', required=True)

	serve_parser = subparsers.add_parser('serve', help='Start the localhost helper API server')
	serve_parser.add_argument('--host', default=None, help='Helper bind host (defaults to env/config)')
	serve_parser.add_argument('--port', type=int, default=None, help='Helper bind port (defaults to env/config)')

	discover_parser = subparsers.add_parser('discover-once', help='Run discovery once and print JSON')
	discover_parser.add_argument('--override-url', default=None, help='Manual backend URL override to verify')

	return parser



def main() -> int:
	args = build_parser().parse_args()
	settings = Settings.from_env()
	if args.command == 'serve':
		if args.host is not None or args.port is not None:
			settings = Settings(
				helper_host=args.host or settings.helper_host,
				helper_port=args.port or settings.helper_port,
				backend_port=settings.backend_port,
				tcp_timeout_seconds=settings.tcp_timeout_seconds,
				verify_timeout_seconds=settings.verify_timeout_seconds,
				scan_timeout_seconds=settings.scan_timeout_seconds,
				max_concurrency=settings.max_concurrency,
				max_hosts_per_network=settings.max_hosts_per_network,
				verify_paths=settings.verify_paths,
				cache_path=settings.cache_path,
			)
		server = create_http_server(settings)
		print(f'[helper] Listening on http://{settings.helper_host}:{settings.helper_port}')
		try:
			server.serve_forever()
		except KeyboardInterrupt:
			print('[helper] Stopping helper.')
			server.shutdown()
			server.server_close()
		return 0

	if args.command == 'discover-once':
		try:
			payload = asyncio.run(_discover_once(settings, args.override_url))
		except DiscoveryError as error:
			print(json.dumps({'error': str(error)}, indent=2), file=sys.stderr)
			return 1
		print(json.dumps(payload, indent=2))
		return 0

	return 1


if __name__ == '__main__':
	raise SystemExit(main())
