import multer from 'multer';

import { sendError } from '../utils/http/response.util.js';

function notFoundHandler(req, res) {
  return sendError(res, {
    statusCode: 404,
    message: 'Route not found',
    errorCode: 'ROUTE_NOT_FOUND',
    details: {
      method: req.method,
      path: req.originalUrl,
    },
  });
}

function normalizeError(error) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return {
        statusCode: 400,
        message: 'Invalid request payload',
        errorCode: 'INVALID_REQUEST_PAYLOAD',
        details: ['Uploaded file exceeds allowed size'],
      };
    }

    return {
      statusCode: 400,
      message: 'Invalid request payload',
      errorCode: 'INVALID_REQUEST_PAYLOAD',
      details: [error.message],
    };
  }

  return {
    statusCode: error?.statusCode || 500,
    message: error?.message || 'Internal server error',
    errorCode: error?.errorCode || 'INTERNAL_SERVER_ERROR',
    details: error?.details || null,
  };
}

function globalErrorHandler(error, req, res, next) {
  const normalized = normalizeError(error);

  // eslint-disable-next-line no-console
  console.error('Unhandled error:', normalized.message);

  return sendError(res, normalized);
}

export { globalErrorHandler, notFoundHandler };
