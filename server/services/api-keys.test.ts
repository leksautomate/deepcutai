import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the storage module
vi.mock('../storage', () => ({
    storage: {
        getApiKey: vi.fn(),
    },
}));

// Mock the db module
vi.mock('../db', () => ({
    db: {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
            }),
        }),
    },
}));

import { getResolvedApiKey, hasApiKey } from './api-keys';
import { storage } from '../storage';

describe('api-keys service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear environment variables
        delete process.env.GEMINI_API_KEY;
        delete process.env.GROQ_API_KEY;
        delete process.env.SPEECHIFY_API_KEY;
        delete process.env.FREEPIK_API_KEY;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getResolvedApiKey', () => {
        it('should return API key from database when available', async () => {
            const mockApiKey = { apiKey: 'db-api-key-123', isActive: true };
            vi.mocked(storage.getApiKey).mockResolvedValue(mockApiKey as any);

            const result = await getResolvedApiKey('gemini', 'user-123');

            expect(result).toBe('db-api-key-123');
            expect(storage.getApiKey).toHaveBeenCalledWith('user-123', 'gemini');
        });

        it('should return null for inactive API key', async () => {
            const mockApiKey = { apiKey: 'db-api-key-123', isActive: false };
            vi.mocked(storage.getApiKey).mockResolvedValue(mockApiKey as any);

            const result = await getResolvedApiKey('gemini', 'user-123');

            expect(result).toBeNull();
        });

        it('should fall back to environment variable when database key not found', async () => {
            vi.mocked(storage.getApiKey).mockResolvedValue(undefined);
            process.env.GEMINI_API_KEY = 'env-api-key-456';

            const result = await getResolvedApiKey('gemini', 'user-123');

            expect(result).toBe('env-api-key-456');
        });

        it('should return null for unknown provider', async () => {
            const result = await getResolvedApiKey('unknown-provider', 'user-123');

            expect(result).toBeNull();
        });

        it('should check all aliases for seedream provider', async () => {
            vi.mocked(storage.getApiKey)
                .mockResolvedValueOnce(undefined) // First alias check
                .mockResolvedValueOnce({ apiKey: 'freepik-key', isActive: true } as any);

            const result = await getResolvedApiKey('seedream', 'user-123');

            expect(result).toBe('freepik-key');
            expect(storage.getApiKey).toHaveBeenCalledWith('user-123', 'seedream');
            expect(storage.getApiKey).toHaveBeenCalledWith('user-123', 'freepik');
        });
    });

    describe('hasApiKey', () => {
        it('should return true when API key exists', async () => {
            vi.mocked(storage.getApiKey).mockResolvedValue({
                apiKey: 'test-key',
                isActive: true
            } as any);

            const result = await hasApiKey('gemini', 'user-123');

            expect(result).toBe(true);
        });

        it('should return false when API key does not exist', async () => {
            vi.mocked(storage.getApiKey).mockResolvedValue(undefined);

            const result = await hasApiKey('gemini', 'user-123');

            expect(result).toBe(false);
        });
    });
});
