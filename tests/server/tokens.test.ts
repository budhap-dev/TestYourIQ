// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  deriveKeys,
  openItemToken,
  sealItemToken,
  signTakerId,
  verifyTakerToken,
} from '../../server/tokens';

const keys = deriveKeys('test-secret-test-secret-test-secret-123');
const other = deriveKeys('another-secret-another-secret-another-1');
const id = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('test-taker tokens', () => {
  it('verify only with the right key and an untouched id', () => {
    const token = signTakerId(id, keys);
    expect(verifyTakerToken(token, keys)).toBe(id);
    expect(verifyTakerToken(token, other)).toBeNull();
    expect(verifyTakerToken(token.replace('0f8f', '1f8f'), keys)).toBeNull();
    expect(verifyTakerToken(`${id}.`, keys)).toBeNull();
    expect(verifyTakerToken('not-a-uuid.abc', keys)).toBeNull();
    expect(verifyTakerToken(null, keys)).toBeNull();
  });
});

describe('item tokens', () => {
  const payload = {
    attemptId: id,
    position: 3,
    itemKey: 'gen:matrix:v1:d3:123456789',
    expiresAt: 1_900_000_000_000,
  };

  it('round-trip with the right key', () => {
    expect(openItemToken(sealItemToken(payload, keys), keys)).toEqual(payload);
  });

  it('hide the item key and seed', () => {
    const token = sealItemToken(payload, keys);
    const decoded = Buffer.from(token, 'base64url').toString('latin1');
    expect(decoded).not.toContain('matrix');
    expect(decoded).not.toContain('123456789');
    expect(sealItemToken(payload, keys)).not.toBe(token); // fresh IV each time
  });

  it('reject tampering, wrong keys and junk', () => {
    const token = sealItemToken(payload, keys);
    const raw = Buffer.from(token, 'base64url');
    raw[20] = (raw[20] ?? 0) ^ 1;
    expect(openItemToken(raw.toString('base64url'), keys)).toBeNull();
    expect(openItemToken(token, other)).toBeNull();
    expect(openItemToken('junk', keys)).toBeNull();
    expect(openItemToken('', keys)).toBeNull();
  });
});
