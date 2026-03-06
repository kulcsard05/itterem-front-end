from __future__ import annotations

from dataclasses import dataclass
import ipaddress
import socket
from typing import Iterable

try:
	import psutil  # type: ignore
except ImportError:  # pragma: no cover - dependency is declared in requirements.txt
	psutil = None


@dataclass(frozen=True)
class CandidateNetwork:
	interface_name: str
	local_ip: str
	network: ipaddress.IPv4Network



def enumerate_candidate_networks() -> list[CandidateNetwork]:
	if psutil is None:
		raise RuntimeError('psutil is required for reliable interface enumeration. Install requirements.txt first.')

	results: list[CandidateNetwork] = []
	seen: set[tuple[str, str]] = set()
	stats = psutil.net_if_stats()

	for interface_name, addresses in psutil.net_if_addrs().items():
		interface_stats = stats.get(interface_name)
		if interface_stats is not None and not interface_stats.isup:
			continue

		for address in addresses:
			if address.family != socket.AF_INET:
				continue
			if not address.address or not address.netmask:
				continue

			ip = ipaddress.IPv4Address(address.address)
			if ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_unspecified:
				continue

			network = ipaddress.IPv4Network(f'{address.address}/{address.netmask}', strict=False)
			key = (interface_name, str(network))
			if key in seen:
				continue
			seen.add(key)
			results.append(CandidateNetwork(interface_name=interface_name, local_ip=str(ip), network=network))

	results.sort(key=lambda item: (item.network.prefixlen, item.interface_name, item.local_ip), reverse=True)
	return results



def _bounded_hosts(network: ipaddress.IPv4Network, local_ip: str, max_hosts: int) -> list[str]:
	hosts = [str(host) for host in network.hosts()]
	if not hosts:
		return []
	if len(hosts) <= max_hosts:
		return [host for host in hosts if host != local_ip]

	try:
		local_index = hosts.index(local_ip)
	except ValueError:
		local_index = len(hosts) // 2

	half_window = max_hosts // 2
	start = max(0, local_index - half_window)
	end = min(len(hosts), start + max_hosts)
	start = max(0, end - max_hosts)
	window = hosts[start:end]
	return [host for host in window if host != local_ip]



def prioritize_hosts(
	networks: Iterable[CandidateNetwork],
	cached_ip: str | None,
	max_hosts_per_network: int,
) -> list[str]:
	ordered: list[str] = []
	seen: set[str] = set()
	parsed_cached_ip = None
	if cached_ip:
		try:
			parsed_cached_ip = ipaddress.IPv4Address(cached_ip)
		except ipaddress.AddressValueError:
			parsed_cached_ip = None

	for candidate in networks:
		if parsed_cached_ip and parsed_cached_ip in candidate.network and cached_ip not in seen:
			ordered.append(cached_ip)
			seen.add(cached_ip)

		hosts = _bounded_hosts(candidate.network, candidate.local_ip, max_hosts_per_network)
		for host in hosts:
			if host in seen:
				continue
			ordered.append(host)
			seen.add(host)

	return ordered
