import { createHmac } from 'crypto';

import { hashToken, safeCompareHex } from './token.utils';

describe('hashToken', () => {
  it('produces a consistent HMAC-SHA256 hex digest for the same input', () => {
    const result1 = hashToken('my-token', 'my-secret');
    const result2 = hashToken('my-token', 'my-secret');
    expect(result1).toBe(result2);
    expect(result1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches the expected HMAC-SHA256 output', () => {
    const expected = createHmac('sha256', 'my-secret')
      .update('my-token')
      .digest('hex');
    expect(hashToken('my-token', 'my-secret')).toBe(expected);
  });

  it('produces a different digest when the secret differs', () => {
    const a = hashToken('my-token', 'secret-a');
    const b = hashToken('my-token', 'secret-b');
    expect(a).not.toBe(b);
  });
});

describe('safeCompareHex', () => {
  it('returns true for identical hex digests', () => {
    const hash = hashToken('token', 'secret');
    expect(safeCompareHex(hash, hash)).toBe(true);
  });

  it('returns false for different hex digests', () => {
    const a = hashToken('token-a', 'secret');
    const b = hashToken('token-b', 'secret');
    expect(safeCompareHex(a, b)).toBe(false);
  });

  it('returns false when lengths differ', () => {
    expect(safeCompareHex('ab', 'abcd')).toBe(false);
  });
});
