import { Request, Response } from 'express';
import { z } from 'zod';
import { BaseController } from './BaseController';
import { getAppSettings, updateAppSettings } from '../services/settings';
import { storage } from '../storage';
import { getSecret } from '../utils/secrets';
import { getWhiskCookieStatus } from '../utils/cookie-parser';

// Schema for validating settings updates
const customVoiceSchema = z.object({
    id: z.string(),
    name: z.string(),
    voiceId: z.string(),
    provider: z.enum(["speechify", "inworld"]),
});

const settingsUpdateSchema = z.object({
    customVoices: z.array(customVoiceSchema).optional(),
    sceneSettings: z.object({
        targetWords: z.number().min(1).max(200),
        maxWords: z.number().min(1).max(300),
        minDuration: z.number().min(1).max(60),
        maxDuration: z.number().min(1).max(120),
    }).optional(),
    imageStyleSettings: z.object({
        art_style: z.string(),
        composition: z.string(),
        color_style: z.string(),
        fine_details: z.string(),
    }).optional(),
    transitionSettings: z.object({
        defaultTransition: z.string(),
        transitionDuration: z.number().min(0.1).max(2),
    }).optional(),
    scriptProvider: z.enum(["gemini", "groq"]).optional(),
});

export class SettingsController extends BaseController {

    /**
     * Get application settings
     */
    getSettings(_req: Request, res: Response) {
        return res.json(getAppSettings());
    }

    /**
     * Update application settings
     */
    updateSettings(req: Request, res: Response) {
        try {
            const { customVoices, sceneSettings, imageStyleSettings, transitionSettings, scriptProvider } = this.validateBody(settingsUpdateSchema, req.body);
            updateAppSettings({ customVoices, sceneSettings, imageStyleSettings, transitionSettings, scriptProvider });
            return res.json(getAppSettings());
        } catch (error) {
            return this.handleError(error, res, 'SettingsController.updateSettings');
        }
    }

    /**
     * Get API keys status (configured/missing)
     */
    async getApiKeysStatus(req: Request, res: Response) {
        try {
            const userId = this.getUserId(req);
            const apiKeysData = await storage.getAllApiKeys(userId);

            const hasKey = (provider: string, envVar: string) => {
                const secretName = envVar.toLowerCase();
                return !!getSecret(secretName, envVar) || apiKeysData.some(k => k.provider === provider && k.isActive === true);
            };

            const whiskCookie = apiKeysData.find(k => k.provider === 'whisk')?.apiKey || process.env.WHISK_COOKIE || null;
            const whiskStatus = getWhiskCookieStatus(whiskCookie);

            return res.json({
                gemini: hasKey("gemini", "GEMINI_API_KEY"),
                groq: hasKey("groq", "GROQ_API_KEY"),
                speechify: hasKey("speechify", "SPEECHIFY_API_KEY"),
                freepik: hasKey("seedream", "FREEPIK_API_KEY") || hasKey("freepik", "FREEPIK_API_KEY"),
                wavespeed: hasKey("wavespeed", "WAVESPEED_API_KEY"),
                runpod: hasKey("runpod", "RUNPOD_API_KEY"),
                pollinations: hasKey("pollinations", "POLLINATIONS_API_KEY"),
                inworld: hasKey("inworld", "INWORLD_API_KEY"),
                whisk: hasKey("whisk", "WHISK_COOKIE"),
                whiskStatus: whiskStatus,
            });
        } catch (error) {
            return this.handleError(error, res, 'SettingsController.getApiKeysStatus');
        }
    }

    /**
     * Update API keys
     */
    async updateApiKeys(req: Request, res: Response) {
        try {
            const userId = this.getUserId(req);
            const { gemini, groq, speechify, freepik, wavespeed, runpod, pollinations, inworld, whisk } = req.body;

            // Helper to save API key to database (upsert)
            const saveKeyToDb = async (provider: string, apiKey: string | undefined) => {
                if (!apiKey?.trim()) return;
                const existing = await storage.getApiKey(userId, provider);
                if (existing) {
                    await storage.updateApiKey(existing.id, { apiKey: apiKey.trim() });
                } else {
                    await storage.createApiKey({ provider, apiKey: apiKey.trim(), userId });
                }
            };

            // Save to database (persistent storage)
            await Promise.all([
                saveKeyToDb("gemini", gemini),
                saveKeyToDb("groq", groq),
                saveKeyToDb("speechify", speechify),
                saveKeyToDb("seedream", freepik), // Use "seedream" as canonical name, aliased with "freepik"
                saveKeyToDb("wavespeed", wavespeed),
                saveKeyToDb("runpod", runpod),
                saveKeyToDb("pollinations", pollinations),
                saveKeyToDb("inworld", inworld),
                saveKeyToDb("whisk", whisk),
            ]);

            // Also set in process.env for immediate use (runtime only)
            if (gemini?.trim()) process.env.GEMINI_API_KEY = gemini.trim();
            if (groq?.trim()) process.env.GROQ_API_KEY = groq.trim();
            if (speechify?.trim()) process.env.SPEECHIFY_API_KEY = speechify.trim();
            if (freepik?.trim()) process.env.FREEPIK_API_KEY = freepik.trim();
            if (wavespeed?.trim()) process.env.WAVESPEED_API_KEY = wavespeed.trim();
            if (runpod?.trim()) process.env.RUNPOD_API_KEY = runpod.trim();
            if (pollinations?.trim()) process.env.POLLINATIONS_API_KEY = pollinations.trim();
            if (inworld?.trim()) process.env.INWORLD_API_KEY = inworld.trim();
            if (whisk?.trim()) process.env.WHISK_COOKIE = whisk.trim();

            this.logInfo("API", "API keys saved to database", {
                userId,
                gemini: !!gemini?.trim(),
                groq: !!groq?.trim(),
                speechify: !!speechify?.trim(),
                freepik: !!freepik?.trim(),
                wavespeed: !!wavespeed?.trim(),
                runpod: !!runpod?.trim(),
                pollinations: !!pollinations?.trim(),
                inworld: !!inworld?.trim(),
                whisk: !!whisk?.trim(),
            });

            // Return updated status
            // Reuse logic from getStatus or just call it? calling it requires mock req/res. 
            // Better to inline the response logic or refactor.
            // reusing logic:
            const apiKeysData = await storage.getAllApiKeys(userId);
            const hasKey = (provider: string, envVar: string) => {
                return !!process.env[envVar] || apiKeysData.some(k => k.provider === provider && k.isActive === true);
            };

            return res.json({
                success: true,
                status: {
                    gemini: hasKey("gemini", "GEMINI_API_KEY"),
                    groq: hasKey("groq", "GROQ_API_KEY"),
                    speechify: hasKey("speechify", "SPEECHIFY_API_KEY"),
                    freepik: hasKey("seedream", "FREEPIK_API_KEY"),
                    wavespeed: hasKey("wavespeed", "WAVESPEED_API_KEY"),
                    runpod: hasKey("runpod", "RUNPOD_API_KEY"),
                    pollinations: hasKey("pollinations", "POLLINATIONS_API_KEY"),
                    inworld: hasKey("inworld", "INWORLD_API_KEY"),
                    whisk: hasKey("whisk", "WHISK_COOKIE"),
                },
            });
        } catch (error) {
            return this.handleError(error, res, 'SettingsController.updateApiKeys');
        }
    }
}
