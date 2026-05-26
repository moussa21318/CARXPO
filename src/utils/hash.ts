const ITERATIONS = 100000
const KEY_LENGTH = 64
const ALGORITHM = 'SHA-512'

async function pbkdf2(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as ArrayBufferView<ArrayBuffer>, iterations: ITERATIONS, hash: ALGORITHM },
    keyMaterial, KEY_LENGTH * 8,
  )
  return new Uint8Array(bits as ArrayBuffer)
}

function toB64(u: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(u)))
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

export async function hash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await pbkdf2(password, salt)
  return `pbkdf2_100000_${toB64(salt)}_${toB64(derived)}`
}

export async function verify(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith('pbkdf2_')) return false
  const parts = stored.split('_')
  if (parts.length < 4) return false
  const salt = fromB64(parts[2])
  const hash = fromB64(parts[3])
  const derived = await pbkdf2(password, salt)
  if (derived.length !== hash.length) return false
  return derived.every((b, i) => b === hash[i])
}
