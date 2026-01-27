import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        existsSync: vi.fn(),
        readdirSync: vi.fn(),
        statSync: vi.fn(),
        unlinkSync: vi.fn(),
        rmdirSync: vi.fn(),
        lstatSync: vi.fn(),
        mkdirSync: vi.fn(),
        appendFileSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
    };
});

// Mock logger to prevent actual file operations during tests
vi.mock('./logger', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    clearOldLogs: vi.fn(),
}));

import { getStorageStats, cleanupOldAssets } from './cleanup';

describe('cleanup service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getStorageStats', () => {
        it('should return zero stats when assets directory does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const stats = getStorageStats();

            expect(stats).toEqual({
                totalProjects: 0,
                totalSizeMB: 0,
            });
        });

        it('should count projects in assets directory', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readdirSync).mockReturnValue(['project-1', 'project-2', 'previews'] as any);
            vi.mocked(fs.statSync).mockReturnValue({
                isDirectory: () => true,
                size: 1024,
                mtimeMs: Date.now(),
            } as any);

            const stats = getStorageStats();

            // Should exclude 'previews' folder
            expect(stats.totalProjects).toBe(2);
        });
    });

    describe('cleanupOldAssets', () => {
        it('should return empty result when assets directory does not exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const result = await cleanupOldAssets();

            expect(result.deletedProjects).toEqual([]);
            expect(result.deletedFiles).toBe(0);
            expect(result.freedBytes).toBe(0);
            expect(result.errors).toEqual([]);
        });

        it('should not delete projects younger than MAX_AGE_HOURS', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readdirSync).mockReturnValue(['new-project'] as any);
            vi.mocked(fs.statSync).mockReturnValue({
                isDirectory: () => true,
                mtimeMs: Date.now() - (1 * 60 * 60 * 1000), // 1 hour old
            } as any);

            const result = await cleanupOldAssets();

            expect(result.deletedProjects).toEqual([]);
            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });
    });
});
