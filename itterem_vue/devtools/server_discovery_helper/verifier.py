from __future__ import annotations

from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen
import json

from config import Settings



def _looks_like_backend_payload(path: str, payload: object) -> bool:
	if path in {'/api/Kategoria', '/api/Keszetelek'}:
		return isinstance(payload, list)
	return isinstance(payload, (list, dict))



def verify_backend_url(base_url: str, settings: Settings) -> dict[str, object] | None:
	clean_base = base_url.rstrip('/') + '/'

	for path in settings.verify_paths:
		url = urljoin(clean_base, path.lstrip('/'))
		request = Request(url, headers={'Accept': 'application/json'})
		try:
			with urlopen(request, timeout=settings.verify_timeout_seconds) as response:
				content_type = response.headers.get('Content-Type', '')
				raw_body = response.read().decode('utf-8', errors='replace')
		except HTTPError as error:
			if error.code not in {200, 401, 403}:
				continue
			content_type = error.headers.get('Content-Type', '')
			raw_body = error.read().decode('utf-8', errors='replace')
			response_code = error.code
		except URLError:
			continue
		else:
			response_code = response.status

		payload: object = raw_body.strip()
		if 'json' in content_type.lower() and raw_body.strip():
			try:
				payload = json.loads(raw_body)
			except json.JSONDecodeError:
				payload = raw_body.strip()

		if _looks_like_backend_payload(path, payload):
			return {
				'baseUrl': clean_base.rstrip('/'),
				'verifiedPath': path,
				'statusCode': response_code,
			}

	return None
