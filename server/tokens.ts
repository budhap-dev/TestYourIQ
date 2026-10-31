import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Two kinds of token, both keyed from SESSION_SECRET:
 *  - test-taker tokens: `<uuid>.<hmac>`, signed so a client can't claim someone else's id
 *  - item tokens: AES-256-GCM encrypted, so the client can't read the item key or seed
 *    (the repo is public; knowing a seed would let anyone regenerate the answer)
 */

export interface Keys {
  sign: Buffer;
  encrypt: Buffer;
}

export function deriveKeys(secret: string): Keys {
  const derive = (info: string) => Buffer.from(hkdfSync('sha256', secret, 'unIQo', info, 32));
  return { sign: derive('taker-id'), encrypt: derive('item-token') };
}

const b64 = (buf: Buffer) => buf.toString('base64url');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function signTakerId(id: string, keys: Keys): string {
  return `${id}.${b64(createHmac('sha256', keys.sign).update(id).digest())}`;
}

export function verifyTakerToken(token: string | null | undefined, keys: Keys): string | null {
  if (!token) return null;
  const [id, sig] = token.split('.');
  if (!id || !sig || !UUID.test(id)) return null;
  const expected = Buffer.from(signTakerId(id, keys).split('.')[1] as string);
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

export interface ItemTokenPayload {
  attemptId: string;
  position: number;
  itemKey: string;
  /** Milliseconds since epoch after which the token is stale. */
  expiresAt: number;
}

export function sealItemToken(payload: ItemTokenPayload, keys: Keys): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keys.encrypt, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return b64(Buffer.concat([iv, body, cipher.getAuthTag()]));
}

export function openItemToken(token: string, keys: Keys): ItemTokenPayload | null {
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length < 12 + 16 + 2) return null;
    const decipher = createDecipheriv('aes-256-gcm', keys.encrypt, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const json = Buffer.concat([
      decipher.update(raw.subarray(12, raw.length - 16)),
      decipher.final(),
    ]);
    const p = JSON.parse(json.toString('utf8')) as Partial<ItemTokenPayload>;
    if (
      typeof p.attemptId !== 'string' ||
      typeof p.position !== 'number' ||
      typeof p.itemKey !== 'string' ||
      typeof p.expiresAt !== 'number'
    ) {
      return null;
    }
    return p as ItemTokenPayload;
  } catch {
    return null;
  }
}
