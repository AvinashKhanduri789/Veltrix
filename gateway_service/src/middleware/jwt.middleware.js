import path from 'node:path';

import { sendError } from '../utils/http/response.util.js';
import { verifyAccessToken } from '../utils/auth/token.util.js';

function extractAccessToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }

  return req.cookies?.accessToken || null;
}

function jwtAuth(req, res, next) {
  try {
    const token = extractAccessToken(req);

    if (!token) {
      return sendError(res, {
        statusCode: 401,
        message: 'Authentication required',
        errorCode: 'AUTH_REQUIRED',
      });
    }

    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    // Backward compatibility for controllers that read req.user.id.
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return next();
  } catch (error) {
    return sendError(res, {
      statusCode: 401,
      message: 'Invalid or expired token',
      errorCode: 'INVALID_TOKEN',
    });
  }
}

function jwtAuthOptional(req, res, next) {
  const token = extractAccessToken(req);
  if (!token) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch (error) {
    return sendError(res, {
      statusCode: 401,
      message: 'Invalid or expired token',
      errorCode: 'INVALID_TOKEN',
    });
  }

  return next();
}

export { jwtAuth, jwtAuthOptional };
