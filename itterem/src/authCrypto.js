import CryptoJS from 'crypto-js';

export function sha256Hex(value) {
  return CryptoJS.SHA256(String(value)).toString(CryptoJS.enc.Hex);
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomSaltHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
