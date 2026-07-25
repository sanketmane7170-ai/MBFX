import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

function makeService(key = 'a-sufficiently-long-test-encryption-key-1234'): CryptoService {
  const config = { getOrThrow: () => key } as unknown as ConfigService;
  return new CryptoService(config);
}

describe('CryptoService', () => {
  it('round-trips plaintext', () => {
    const svc = makeService();
    const secret = 'broker-password-!@#$%^&*()';
    const enc = svc.encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(svc.decrypt(enc)).toBe(secret);
  });

  it('produces a fresh IV each time (ciphertext differs)', () => {
    const svc = makeService();
    expect(svc.encrypt('same')).not.toBe(svc.encrypt('same'));
  });

  it('emits the iv:tag:data format', () => {
    const enc = makeService().encrypt('x');
    expect(enc.split(':')).toHaveLength(3);
  });

  it('fails to decrypt with a different key', () => {
    const enc = makeService('key-one-key-one-key-one-key-one-key-one').encrypt('secret');
    expect(() => makeService('key-two-key-two-key-two-key-two-key-two').decrypt(enc)).toThrow();
  });

  it('rejects tampered ciphertext (GCM auth)', () => {
    const svc = makeService();
    const [iv, tag, data] = svc.encrypt('secret').split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 0xff;
    expect(() => svc.decrypt(`${iv}:${tag}:${flipped.toString('base64')}`)).toThrow();
  });

  it('rejects malformed ciphertext', () => {
    expect(() => makeService().decrypt('nope')).toThrow('Malformed ciphertext');
  });
});
