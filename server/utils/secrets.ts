import fs from 'fs';
import path from 'path';

/**
 * Reads a secret from Docker secrets (file) or falls back to environment variable.
 * Docker secrets are typically mounted at /run/secrets/<secret_name>
 */
export function getSecret(secretName: string, envVarName?: string): string | undefined {
    // 1. Try to read from Docker secret file
    const secretPath = path.join('/run/secrets', secretName);
    try {
        if (fs.existsSync(secretPath)) {
            const secretValue = fs.readFileSync(secretPath, 'utf8').trim();
            if (secretValue) {
                return secretValue;
            }
        }
    } catch (err) {
        // Ignore error reading file, proceed to env var
    }

    // 2. Fallback to environment variable
    const envName = envVarName || secretName.toUpperCase();
    return process.env[envName];
}

/**
 * Helper to get required secret, throwing error if missing
 */
export function getRequiredSecret(secretName: string, envVarName?: string): string {
    const value = getSecret(secretName, envVarName);
    if (!value) {
        throw new Error(`Missing required secret: ${secretName} (or env: ${envVarName || secretName.toUpperCase()})`);
    }
    return value;
}
