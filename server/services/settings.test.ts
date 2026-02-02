import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simple unit tests for settings without complex mocking
describe('settings service', () => {
    describe('splitScriptIntoScenes', () => {
        let splitScriptIntoScenes: Function;

        beforeEach(async () => {
            vi.resetModules();

            // Mock fs before importing
            vi.doMock('fs', () => ({
                existsSync: vi.fn().mockReturnValue(false),
                readFileSync: vi.fn().mockReturnValue('{}'),
                writeFileSync: vi.fn(),
                mkdirSync: vi.fn(),
            }));

            const settings = await import('./settings');
            splitScriptIntoScenes = settings.splitScriptIntoScenes;
        });

        it('should split script by paragraphs', () => {
            const script = `First paragraph with some content.

Second paragraph with more content.

Third paragraph to finish.`;

            const scenes = splitScriptIntoScenes(script);

            expect(scenes.length).toBeGreaterThanOrEqual(1);
            expect(Array.isArray(scenes)).toBe(true);
        });

        it('should handle empty script', () => {
            const scenes = splitScriptIntoScenes('');

            expect(scenes).toHaveLength(0);
        });

        it('should return array', () => {
            const scenes = splitScriptIntoScenes('Some text here.');

            expect(Array.isArray(scenes)).toBe(true);
        });
    });

    describe('getAppSettings', () => {
        let getAppSettings: Function;

        beforeEach(async () => {
            vi.resetModules();

            vi.doMock('fs', () => ({
                existsSync: vi.fn().mockReturnValue(false),
                readFileSync: vi.fn().mockReturnValue('{}'),
                writeFileSync: vi.fn(),
                mkdirSync: vi.fn(),
            }));

            const settings = await import('./settings');
            getAppSettings = settings.getAppSettings;
        });

        it('should return an object with sceneSettings', () => {
            const settings = getAppSettings();

            expect(settings).toBeDefined();
            expect(typeof settings).toBe('object');
            expect(settings.sceneSettings).toBeDefined();
        });

        it('should return transitionSettings', () => {
            const settings = getAppSettings();

            expect(settings.transitionSettings).toBeDefined();
        });
    });
});
