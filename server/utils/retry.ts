import { logInfo, logError } from "../services/logger";

interface RetryOptions {
    maxRetries?: number;
    initialDelayMs?: number;
    backoffFactor?: number;
    retryableErrors?: (number | string)[];
}

/**
 * Retries an async operation with exponential backoff.
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
    context: string = "Operation"
): Promise<T> {
    const maxRetries = options.maxRetries || 3;
    const initialDelay = options.initialDelayMs || 1000;
    const backoff = options.backoffFactor || 2;
    const retryableErrors = options.retryableErrors;

    let lastError: any;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            // If we've reached max retries, don't wait, just loop and throw
            if (attempt > maxRetries) {
                break;
            }

            const errorMessage = error instanceof Error ? error.message : String(error);

            // Check if error is retryable if filter is provided
            if (retryableErrors) {
                let isRetryable = false;

                // Check for HTTP status codes in message (e.g. "Status 429")
                const statusMatch = errorMessage.match(/(\d{3})/);
                const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;

                if (retryableErrors.includes(statusCode)) isRetryable = true;

                // Check for string matches
                if (retryableErrors.some(e => typeof e === 'string' && errorMessage.includes(e))) isRetryable = true;

                // Always retry specific network errors
                if (errorMessage.includes("timeout") || errorMessage.includes("ECONNRESET")) isRetryable = true;

                if (!isRetryable) {
                    logError("RETRY", `${context} failed with non-retryable error: ${errorMessage}`, error);
                    throw error;
                }
            }

            logInfo("RETRY", `${context} failed (Attempt ${attempt}/${maxRetries}): ${errorMessage}. Retrying in ${delay}ms...`);

            // Wait for delay
            await new Promise(resolve => setTimeout(resolve, delay));

            // Increase delay
            delay *= backoff;
        }
    }

    logError("RETRY", `${context} failed after ${maxRetries} retries`, lastError);
    throw lastError;
}
