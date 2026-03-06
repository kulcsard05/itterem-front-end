from __future__ import annotations

from pathlib import Path
import json
import tempfile
from typing import Any


def load_cache(cache_path: Path) -> dict[str, Any]:
	try:
		return json.loads(cache_path.read_text(encoding='utf-8'))
	except FileNotFoundError:
		return {}
	except json.JSONDecodeError:
		return {}



def save_cache(cache_path: Path, payload: dict[str, Any]) -> None:
	cache_path.parent.mkdir(parents=True, exist_ok=True)
	with tempfile.NamedTemporaryFile('w', delete=False, dir=cache_path.parent, encoding='utf-8') as handle:
		json.dump(payload, handle, indent=2, sort_keys=True)
		handle.write('\n')
		temporary_path = Path(handle.name)
	temporary_path.replace(cache_path)
