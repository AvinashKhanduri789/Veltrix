import { createHash } from 'node:crypto';

import jwt from 'jsonwebtoken';

const DEFAULT_ACCESS_TOKEN_TTL = '15m';
const DEFAULT_REFRESH_TOKEN_TTL = '7d';

function getJwtConfig() {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set');
  }

  return {
    accessSecret,
    refreshSecret,
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL || DEFAULT_ACCESS_TOKEN_TTL,
    refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || DEFAULT_REFRESH_TOKEN_TTL,
  };
}

function parseDurationToMs(duration, fallbackMs) {
  if (!duration || typeof duration !== 'string') {
    return fallbackMs;
  }

  const match = duration.trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    return fallbackMs;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

function buildAuthPayload(user) {
  return {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
}

function generateTokenPair(user) {
  const config = getJwtConfig();
  const payload = buildAuthPayload(user);

  const accessToken = jwt.sign(payload, config.accessSecret, {
    expiresIn: config.accessTokenTtl,
  });

  const refreshToken = jwt.sign(
    { sub: payload.sub, type: 'refresh' },
    config.refreshSecret,
    { expiresIn: config.refreshTokenTtl },
  );

  const refreshTokenMaxAgeMs = parseDurationToMs(config.refreshTokenTtl, 7 * 24 * 60 * 60 * 1000);
  const accessTokenMaxAgeMs = parseDurationToMs(config.accessTokenTtl, 15 * 60 * 1000);

  return {
    accessToken,
    refreshToken,
    accessTokenMaxAgeMs,
    refreshTokenMaxAgeMs,
  };
}

function verifyAccessToken(token) {
  const { accessSecret } = getJwtConfig();
  return jwt.verify(token, accessSecret);
}

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export { generateTokenPair, hashToken, verifyAccessToken };
