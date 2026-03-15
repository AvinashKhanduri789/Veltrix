function sendSuccess(res, options = {}) {
  const {
    statusCode = 200,
    message = 'Success',
    data = null,
  } = options;

  return res.status(statusCode).json({
    statusCode,
    message,
    error: null,
    data,
  });
}

function sendError(res, options = {}) {
  const {
    statusCode = 500,
    message = 'Request failed',
    errorCode = 'INTERNAL_SERVER_ERROR',
    details = null,
  } = options;

  return res.status(statusCode).json({
    statusCode,
    message,
    error: {
      code: errorCode,
      details,
    },
    data: null,
  });
}

function createHttpError(options = {}) {
  const {
    statusCode = 500,
    message = 'Request failed',
    errorCode = 'INTERNAL_SERVER_ERROR',
    details = null,
  } = options;

  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.details = details;

  return error;
}

export { createHttpError, sendError, sendSuccess };
