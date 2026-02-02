import { storage } from "../storage";
import { db } from "../db";
import { users } from "@shared/schema";
import { parseJsonCookies, getWhiskCookieStatus } from "../utils/cookie-parser";

interface ProviderConfig {
  dbAliases: string[];
  envVar: string;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  gemini: { dbAliases: ["gemini"], envVar: "GEMINI_API_KEY" },
  groq: { dbAliases: ["groq"], envVar: "GROQ_API_KEY" },
  speechify: { dbAliases: ["speechify"], envVar: "SPEECHIFY_API_KEY" },
  inworld: { dbAliases: ["inworld"], envVar: "INWORLD_API_KEY" },
  seedream: { dbAliases: ["seedream", "freepik"], envVar: "FREEPIK_API_KEY" },
  freepik: { dbAliases: ["seedream", "freepik"], envVar: "FREEPIK_API_KEY" },
  wavespeed: { dbAliases: ["wavespeed"], envVar: "WAVESPEED_API_KEY" },
  runpod: { dbAliases: ["runpod"], envVar: "RUNPOD_API_KEY" },
  pollinations: { dbAliases: ["pollinations"], envVar: "POLLINATIONS_API_KEY" },
  whisk: { dbAliases: ["whisk"], envVar: "WHISK_COOKIE" },
};

/**
 * Gets the first admin user ID from the database for background operations.
 * Since this is a single-user app, we just get the first user.
 */
async function getDefaultUserId(): Promise<string | null> {
  try {
    const result = await db.select({ id: users.id }).from(users).limit(1);
    if (result.length > 0) {
      return result[0].id;
    }
  } catch (error) {
    console.error("[API-KEYS] Error fetching default user:", error);
  }
  return null;
}

/**
 * Resolves an API key for a given provider.
 * 1. First checks the database for the user's saved keys (checks all aliases)
 * 2. Falls back to environment variables
 * 
 * @param provider - The provider name (e.g., "seedream", "wavespeed", "runpod")
 * @param userId - Optional user ID to check database keys. If not provided, will try to find the first admin user.
 * @returns The API key or null if not found
 */
export async function getResolvedApiKey(
  provider: string,
  userId?: string
): Promise<string | null> {
  const config = PROVIDER_CONFIGS[provider.toLowerCase()];
  if (!config) {
    console.warn(`[API-KEYS] Unknown provider: ${provider}`);
    return null;
  }

  // Try to get a userId if not provided (for background queue operations)
  const effectiveUserId = userId || await getDefaultUserId();

  // Check database first - try all aliases
  if (effectiveUserId) {
    for (const alias of config.dbAliases) {
      try {
        const dbKey = await storage.getApiKey(effectiveUserId, alias);
        if (dbKey?.apiKey && dbKey.isActive === true) {
          if (provider.toLowerCase() === 'whisk') {
            return convertWhiskCookie(dbKey.apiKey);
          }
          return dbKey.apiKey;
        }
      } catch (error) {
        console.error(`[API-KEYS] Error fetching key for ${alias}:`, error);
      }
    }
  }

  // Fallback to environment variables (always checked)
  const envKey = process.env[config.envVar];
  if (envKey) {
    if (provider.toLowerCase() === 'whisk') {
      return convertWhiskCookie(envKey);
    }
    return envKey;
  }

  return null;
}

function convertWhiskCookie(cookie: string): string {
  try {
    const status = getWhiskCookieStatus(cookie);
    if (status.isExpired) {
      throw new Error('Whisk cookie has expired. Please update with fresh cookies from labs.google.');
    }
    const parsed = parseJsonCookies(cookie);
    return parsed.cookieString;
  } catch (e) {
    if ((e as Error).message.includes('expired')) {
      throw e;
    }
    return cookie;
  }
}

/**
 * Checks if an API key is configured for a provider.
 */
export async function hasApiKey(
  provider: string,
  userId?: string
): Promise<boolean> {
  const key = await getResolvedApiKey(provider, userId);
  return !!key;
}
