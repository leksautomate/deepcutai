import { Request, Response } from 'express';
import { logError, logInfo } from '../services/logger';
import { ZodError, ZodSchema } from 'zod';

/**
 * Base controller class following backend-dev-guidelines
 * All controllers should extend this for consistent error handling
 */
export abstract class BaseController {
    /**
     * Send success response with data
     */
    protected handleSuccess(res: Response, data: unknown, statusCode: number = 200): void {
        res.status(statusCode).json(data);
    }

    /**
     * Send error response with proper logging
     * Automatically determines status code and sanitizes error messages
     */
    protected handleError(
        error: unknown,
        res: Response,
        context: string,
        projectId?: string
    ): Response {
        // Log the error
        logError(context, 'Request failed', error, undefined, projectId);

        // Determine status code and message
        const statusCode = this.getStatusCode(error);
        const message = this.getErrorMessage(error);

        return res.status(statusCode).json({ error: message });
    }

    /**
     * Determine appropriate HTTP status code from error
     */
    private getStatusCode(error: unknown): number {
        if (error instanceof ZodError) {
            return 400; // Bad Request
        }

        if (error instanceof Error) {
            const message = error.message.toLowerCase();

            if (message.includes('not found')) {
                return 404;
            }

            if (message.includes('unauthorized') || message.includes('not authenticated')) {
                return 401;
            }

            if (message.includes('forbidden') || message.includes('permission')) {
                return 403;
            }

            if (message.includes('conflict') || message.includes('already exists')) {
                return 409;
            }

            if (message.includes('validation') || message.includes('invalid')) {
                return 400;
            }
        }

        return 500; // Internal Server Error (default)
    }

    /**
     * Get safe error message to send to client
     * Sanitizes error messages to avoid leaking sensitive information
     */
    private getErrorMessage(error: unknown): string {
        if (error instanceof ZodError) {
            // Return validation errors in user-friendly format
            const firstError = error.errors[0];
            return `Validation error: ${firstError.message} at ${firstError.path.join('.')}  *`;
        }

        if (error instanceof Error) {
            // Return error message if it's safe (doesn't contain stack traces or sensitive info)
            const message = error.message;

            // Don't expose internal errors in production
            if (process.env.NODE_ENV === 'production') {
                // Only return specific known errors
                if (
                    message.includes('not found') ||
                    message.includes('already exists') ||
                    message.includes('invalid') ||
                    message.includes('required') ||
                    message.includes('API key')
                ) {
                    return message;
                }
                return 'Internal server error';
            }

            return message;
        }

        // Unknown error type
        return 'Internal server error';
    }

    /**
     * Validate request body against Zod schema
     * Returns validated data or throws ZodError
     */
    protected validateBody<T>(schema: ZodSchema<T>, data: unknown): T {
        return schema.parse(data);
    }

    /**
     * Extract user ID from authenticated request
     */
    protected getUserId(req: Request): string {
        if (!req.user || !('id' in req.user)) {
            throw new Error('User not authenticated');
        }
        return String((req.user as { id: number | string }).id);
    }

    /**
     * Log info message with context
     */
    protected logInfo(context: string, message: string, data?: Record<string, unknown>): void {
        logInfo(context, message, data);
    }
}
