function isTransientError(error) {
  const status = error.response?.status;
  if (typeof status === 'number') {
    return status >= 500 || status === 403;
  }

  const code = error.code;
  return code === 'ECONNRESET' || code === 'ETIMEDOUT';
}

function isRepsolWafBlock(error) {
  return error && error.response?.status === 403;
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(fn, options = {}) {
  const {
    retries = 3,
    minTimeoutMs = 500,
    factor = 2,
    logger = console,
    sleep = defaultSleep,
  } = options;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!isTransientError(error)) {
        throw error;
      }

      if (attempt === retries) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Retries exhausted after ${retries + 1} attempts: ${message}`);
        throw error;
      }

      const nextAttempt = attempt + 1;
      const is403 = isRepsolWafBlock(error);
      if (is403) {
        logger.warn(`WAF block detected, retry ${nextAttempt}/${retries + 1} after backoff`);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Retry attempt ${nextAttempt} after failure: ${message}`);
      }

      const delay = minTimeoutMs * factor ** attempt;
      const backoffDelay = Math.random() * delay;
      await sleep(backoffDelay);
    }
  }
}

module.exports = {
  retry,
  isTransientError,
  isRepsolWafBlock,
};
