import User from '../../../models/User.js';
import { normalizeEmail } from '../../../utils/auth/email.util.js';
import { hashPassword, isPasswordHashShapeValid, verifyPassword } from '../../../utils/auth/password.util.js';
import { generateTokenPair, hashToken } from '../../../utils/auth/token.util.js';
import { runWithRetry } from '../../../utils/async/retry.util.js';
import { isDuplicateKeyError, isRetryableMongoError } from '../../../utils/db/mongo-error.util.js';
import { setAuthCookies } from '../../../utils/http/cookie.util.js';
import { sendError, sendSuccess } from '../../../utils/http/response.util.js';

const MAX_CREATE_RETRIES = 3;

export async function register(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    const requestedRole = req.body.role;

    if (requestedRole && requestedRole !== 'USER') {
      return sendError(res, {
        statusCode: 403,
        message: 'Role is not allowed for self registration',
        errorCode: 'ROLE_NOT_ALLOWED',
      });
    }

    const existingUser = await User.findOne({ email }).select('_id').lean();
    if (existingUser) {
      return sendError(res, {
        statusCode: 409,
        message: 'Email already registered',
        errorCode: 'EMAIL_ALREADY_EXISTS',
      });
    }

    const passwordHash = await hashPassword(password);
    if (!isPasswordHashShapeValid(passwordHash)) {
      return sendError(res, {
        statusCode: 500,
        message: 'Failed to create user',
        errorCode: 'INVALID_PASSWORD_HASH',
      });
    }

    let createdUser;
    try {
      createdUser = await runWithRetry(
        async () => User.create({ email, passwordHash, role: 'USER' }),
        {
          retries: MAX_CREATE_RETRIES,
          shouldRetry: (error) => isRetryableMongoError(error) && !isDuplicateKeyError(error),
        },
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return sendError(res, {
          statusCode: 409,
          message: 'Email already registered',
          errorCode: 'EMAIL_ALREADY_EXISTS',
        });
      }

      // eslint-disable-next-line no-console
      console.error('Register failed after retries:', error?.message || 'unknown error');
      return sendError(res, {
        statusCode: 503,
        message: 'Unable to register user right now. Please retry.',
        errorCode: 'REGISTER_TEMPORARY_UNAVAILABLE',
      });
    }

    return sendSuccess(res, {
      statusCode: 201,
      message: 'User registered successfully',
      data: {
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Register handler error:', error.message);
    return sendError(res, {
      statusCode: 500,
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    });
  }
}

export async function login(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return sendError(res, {
        statusCode: 401,
        message: 'Invalid email or password',
        errorCode: 'INVALID_CREDENTIALS',
      });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return sendError(res, {
        statusCode: 401,
        message: 'Invalid email or password',
        errorCode: 'INVALID_CREDENTIALS',
      });
    }

    const tokens = generateTokenPair(user);
    const refreshTokenHash = hashToken(tokens.refreshToken);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          refreshTokenHash,
          refreshTokenExpiresAt: new Date(Date.now() + tokens.refreshTokenMaxAgeMs),
        },
      },
    );

    setAuthCookies(res, tokens);

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Login successful',
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Login handler error:', error.message);
    return sendError(res, {
      statusCode: 500,
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    });
  }
}

export async function getCurrentUser(req, res) {
  try {
    const user = await User.findById(req.auth?.userId).select('_id email role').lean();

    if (!user) {
      return sendError(res, {
        statusCode: 404,
        message: 'User not found',
        errorCode: 'USER_NOT_FOUND',
      });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Current user fetched successfully',
      data: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Get current user handler error:', error.message);
    return sendError(res, {
      statusCode: 500,
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    });
  }
}
