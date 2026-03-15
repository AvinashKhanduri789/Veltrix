async function runWithRetry(operation, options = {}) {
  const {
    retries = 3,
    shouldRetry = () => false,
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === retries) {
        break;
      }
    }
  }

  throw lastError;
}

export { runWithRetry };
