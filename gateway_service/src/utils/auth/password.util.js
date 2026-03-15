import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derivedKey).toString('hex')}`;
}

async function verifyPassword(password, passwordHash) {
  const [salt, originalHex] = String(passwordHash || '').split(':');
  if (!salt || !originalHex) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, 64);
  const derivedHex = Buffer.from(derivedKey).toString('hex');

  const a = Buffer.from(originalHex, 'hex');
  const b = Buffer.from(derivedHex, 'hex');

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function isPasswordHashShapeValid(hash) {
  const [salt, hex] = String(hash).split(':');
  if (!salt || !hex) {
    return false;
  }

  if (hex.length !== 128) {
    return false;
  }

  const a = Buffer.from(hex, 'hex');
  const b = Buffer.from(hex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export { hashPassword, isPasswordHashShapeValid, verifyPassword };
