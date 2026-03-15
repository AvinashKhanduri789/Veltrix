const RETRYABLE_ERROR_CODES = new Set([6, 7, 89, 91, 189, 262, 9001, 10107, 11600, 11602, 13435, 13436]);

function isDuplicateKeyError(error) {
  return error?.name === 'MongoServerError' && error?.code === 11000;
}

function isRetryableMongoError(error) {
  if (!error) {
    return false;
  }

  if (RETRYABLE_ERROR_CODES.has(error.code)) {
    return true;
  }

  if (error.name === 'MongoNetworkError' || error.name === 'MongoNetworkTimeoutError') {
    return true;
  }

  if (Array.isArray(error.errorLabels)) {
    return error.errorLabels.includes('RetryableWriteError') || error.errorLabels.includes('TransientTransactionError');
  }

  return false;
}

export { isDuplicateKeyError, isRetryableMongoError };
