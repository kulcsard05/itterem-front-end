from __future__ import annotations

from dataclasses import asdict, dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import threading
from typing import Any
from urllib.parse import urlparse

from cache import load_cache, save_cache
from config import Settings
import asyncio

from scanner import DiscoveryError, discover_backend


LOCAL_CLIENTS = {'127.0.0.1', '::1'}
LOCAL_ORIGIN_HOSTS = {'localhost', '127.0.0.1'}


@dataclass
class DiscoveryState:
	status: str = 'idle'
	result: dict[str, Any] | None = None
	error: str | None = None
	progress: dict[str, Any] | None = None
	overrideUrl: str | None = None


class DiscoveryService:
	def __init__(self, settings: Settings):
		self.settings = settings
		self._lock = threading.Lock()
		self._thread: threading.Thread | None = None
		cache_payload = load_cache(settings.cache_path)
		last_result = cache_payload.get('lastResult') if isinstance(cache_payload, dict) else None
		override_url = cache_payload.get('overrideUrl') if isinstance(cache_payload, dict) else None
		self.state = DiscoveryState(
			status='idle',
			result=last_result if isinstance(last_result, dict) else None,
			overrideUrl=override_url if isinstance(override_url, str) else None,
		)

	def snapshot(self) -> dict[str, Any]:
		with self._lock:
			return asdict(self.state)

	def _update_progress(self, payload: dict[str, Any]) -> None:
		with self._lock:
			self.state.progress = payload

	def start_discovery(self) -> dict[str, Any]:
		with self._lock:
			if self._thread is not None and self._thread.is_alive():
				return asdict(self.state)
			self.state.status = 'running'
			self.state.error = None
			self.state.progress = {'phase': 'queued'}
			thread = threading.Thread(target=self._run_discovery, name='itterem-discovery', daemon=True)
			self._thread = thread
			thread.start()
			return asdict(self.state)

	def _run_discovery(self) -> None:
		override_url = self.snapshot().get('overrideUrl')
		try:
			result = asyncio.run(
				discover_backend(
					self.settings,
					on_progress=self._update_progress,
					override_url=override_url if isinstance(override_url, str) else None,
				),
			)
		except DiscoveryError as error:
			with self._lock:
				self.state.status = 'error'
				self.state.error = str(error)
				self.state.progress = {'phase': 'error'}
			return
		except Exception as error:  # pragma: no cover - defensive server boundary
			with self._lock:
				self.state.status = 'error'
				self.state.error = f'Unexpected discovery failure: {error}'
				self.state.progress = {'phase': 'error'}
			return

		with self._lock:
			self.state.status = 'found'
			self.state.result = result.to_dict()
			self.state.error = None
			self.state.progress = {'phase': 'complete'}

	def set_override(self, override_url: str) -> dict[str, Any]:
		parsed = urlparse(override_url)
		if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
			raise ValueError('Override URL must be a valid http:// or https:// URL.')

		with self._lock:
			self.state.overrideUrl = override_url.rstrip('/')
		payload = load_cache(self.settings.cache_path)
		payload['overrideUrl'] = self.state.overrideUrl
		save_cache(self.settings.cache_path, payload)
		return asdict(self.state)

	def clear_override(self) -> dict[str, Any]:
		with self._lock:
			self.state.overrideUrl = None
			self.state.result = None
			self.state.status = 'idle'
			self.state.progress = None
			self.state.error = None
		payload = load_cache(self.settings.cache_path)
		payload.pop('overrideUrl', None)
		payload.pop('lastResult', None)
		save_cache(self.settings.cache_path, payload)
		return asdict(self.state)



def create_http_server(settings: Settings) -> ThreadingHTTPServer:
	service = DiscoveryService(settings)

	class RequestHandler(BaseHTTPRequestHandler):
		server_version = 'ItteremDiscoveryHelper/0.1'

		def do_OPTIONS(self) -> None:  # noqa: N802
			if not self._is_local_client():
				self._send_json(403, {'error': 'Local access only.'})
				return

			self.send_response(204)
			self._send_cors_headers()
			self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
			self.send_header('Access-Control-Allow-Headers', 'Content-Type')
			self.send_header('Access-Control-Max-Age', '600')
			self.send_header('Content-Length', '0')
			self.end_headers()

		def do_GET(self) -> None:  # noqa: N802
			if not self._is_local_client():
				self._send_json(403, {'error': 'Local access only.'})
				return

			request_path = self._request_path()

			if request_path == '/status':
				self._send_json(200, service.snapshot())
				return
			if request_path == '/result':
				self._send_json(200, service.snapshot())
				return

			self._send_json(404, {'error': 'Not found'})

		def do_POST(self) -> None:  # noqa: N802
			if not self._is_local_client():
				self._send_json(403, {'error': 'Local access only.'})
				return

			request_path = self._request_path()

			if request_path == '/discover':
				self._read_json_body()
				self._send_json(202, service.start_discovery())
				return
			if request_path == '/override':
				payload = self._read_json_body()
				override_url = str(payload.get('baseUrl') or payload.get('url') or '').strip()
				if not override_url:
					self._send_json(400, {'error': 'baseUrl is required.'})
					return
				try:
					self._send_json(200, service.set_override(override_url))
				except ValueError as error:
					self._send_json(400, {'error': str(error)})
				return

			self._send_json(404, {'error': 'Not found'})

		def do_DELETE(self) -> None:  # noqa: N802
			if not self._is_local_client():
				self._send_json(403, {'error': 'Local access only.'})
				return

			if self._request_path() == '/override':
				self._send_json(200, service.clear_override())
				return

			self._send_json(404, {'error': 'Not found'})

		def log_message(self, format: str, *args: object) -> None:  # noqa: A003
			message = format % args
			print(f'[helper] {self.address_string()} {message}')

		def _is_local_client(self) -> bool:
			return self.client_address[0] in LOCAL_CLIENTS

		def _request_path(self) -> str:
			parsed = urlparse(self.path)
			path = parsed.path.rstrip('/')
			return path or '/'

		def _cors_origin(self) -> str | None:
			origin = self.headers.get('Origin')
			if not origin:
				return None

			parsed = urlparse(origin)
			if parsed.scheme not in {'http', 'https'}:
				return None
			if parsed.hostname not in LOCAL_ORIGIN_HOSTS:
				return None
			return origin

		def _send_cors_headers(self) -> None:
			origin = self._cors_origin()
			if origin:
				self.send_header('Access-Control-Allow-Origin', origin)
				self.send_header('Vary', 'Origin')

		def _read_json_body(self) -> dict[str, Any]:
			content_length = int(self.headers.get('Content-Length', '0') or 0)
			if content_length <= 0:
				return {}
			raw_body = self.rfile.read(content_length).decode('utf-8', errors='replace')
			if not raw_body.strip():
				return {}
			try:
				return json.loads(raw_body)
			except json.JSONDecodeError:
				return {}

		def _send_json(self, status_code: int, payload: dict[str, Any]) -> None:
			body = json.dumps(payload, indent=2, sort_keys=True).encode('utf-8')
			self.send_response(status_code)
			self._send_cors_headers()
			self.send_header('Content-Type', 'application/json; charset=utf-8')
			self.send_header('Content-Length', str(len(body)))
			self.end_headers()
			self.wfile.write(body)

	server = ThreadingHTTPServer((settings.helper_host, settings.helper_port), RequestHandler)
	server.daemon_threads = True
	return server
