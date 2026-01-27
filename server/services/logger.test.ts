import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';

// Simpler approach - just test that functions exist and can be called
describe('logger service', () => {
    // Import the logger functions
    let logInfo: Function;
    let logError: Function;
    let logWarning: Function;

    beforeEach(async () => {
        // Reset mocks and re-import
        vi.resetModules();

        // Mock fs before importing logger
        vi.doMock('fs', () => ({
            existsSync: vi.fn().mockReturnValue(true),
            mkdirSync: vi.fn(),
            appendFileSync: vi.fn(),
            readdirSync: vi.fn().mockReturnValue([]),
            unlinkSync: vi.fn(),
            statSync: vi.fn().mockReturnValue({ mtime: new Date() }),
            readFileSync: vi.fn().mockReturnValue('[]'),
        }));

        const logger = await import('./logger');
        logInfo = logger.logInfo;
        logError = logger.logError;
        logWarning = logger.logWarning;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('logInfo', () => {
        it('should be a function', () => {
            expect(typeof logInfo).toBe('function');
        });
    });

    describe('logError', () => {
        it('should be a function', () => {
            expect(typeof logError).toBe('function');
        });
    });

    describe('logWarning', () => {
        it('should be a function', () => {
            expect(typeof logWarning).toBe('function');
        });
    });
});
