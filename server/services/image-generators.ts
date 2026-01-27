import fetch from "node-fetch";
import { logInfo } from "./logger";

import { withRetry } from "../utils/retry";


interface WaveSpeedResponse {
  data: {
    id: string;
    status: string;
    outputs?: string[];
    error?: string;
  };
}

/**
 * Generates an image using WaveSpeed.ai (Stable Diffusion Turbo).
 * 
 * @param prompt - The image prompt
 * @param apiKey - WaveSpeed API key
 * @param width - Image width (default 1024)
 * @param height - Image height (default 576)
 * @param seed - Random seed (default -1 for random)
 * @returns URL of the generated image
 */
export async function generateImageWithWaveSpeed(
  prompt: string,
  apiKey: string,
  width: number = 1024,
  height: number = 576,
  seed: number = -1,
): Promise<string> {
  const url = "https://api.wavespeed.ai/api/v3/wavespeed-ai/z-image/turbo";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // WaveSpeed specific size mapping for supported resolutions
  let sizeStr: string;
  const aspectRatio = width / height;

  if (aspectRatio < 1) {
    // Vertical/Portrait - use 720*1280 for WaveSpeed
    sizeStr = "720*1280";
  } else if (aspectRatio > 1) {
    // Horizontal/Landscape - use 1280*720 for WaveSpeed
    sizeStr = "1280*720";
  } else {
    // Square
    sizeStr = "1024*1024";
  }
  const payload = {
    enable_base64_output: false,
    enable_sync_mode: false,
    output_format: "jpeg",
    prompt: prompt,
    seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed,
    size: sizeStr,
  };

  return withRetry(
    async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`WaveSpeed API error: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as WaveSpeedResponse;
      const requestId = result.data.id;

      // Poll for completion
      for (let i = 0; i < 120; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResponse = await fetch(
          `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
        );

        const statusResult = (await statusResponse.json()) as WaveSpeedResponse;

        if (statusResponse.ok) {
          const data = statusResult.data;
          const status = data.status;

          if (status === "completed" && data.outputs && data.outputs.length > 0) {
            logInfo("image", `WaveSpeed image generated successfully`, { requestId });
            return data.outputs[0];
          } else if (status === "failed") {
            throw new Error(`WaveSpeed generation failed: ${data.error}`);
          }
        }
      }

      throw new Error("WaveSpeed generation timeout");
    },
    {
      maxRetries: 3,
      initialDelayMs: 2000,
      retryableErrors: [429, 500, 502, 503, 504],
    },
    "WaveSpeed"
  );
}

export interface PollinationsResult {
  imageBuffer: Buffer;
  url: string;
}

export interface PollinationsOptions {
  prompt: string;
  apiKey?: string | null;
  width?: number;
  height?: number;
  model?: string;
  seed?: number;
  enhance?: boolean;
  negativePrompt?: string;
  safe?: boolean;
}

/**
 * Generates an image using Pollinations.ai (Free/Open API).
 * 
 * @param prompt - The image prompt
 * @param apiKey - Optional API key for higher limits
 * @param width - Image width
 * @param height - Image height
 * @param model - Model to use (default: zimage)
 * @param seed - Random seed
 * @param options - Additional options like enhancement and safety
 * @returns Object containing image buffer and source URL
 */
export async function generateImageWithPollinations(
  prompt: string,
  apiKey: string | null,
  width: number = 1024,
  height: number = 576,
  model: string = "zimage",
  seed: number = -1,
  options?: Partial<PollinationsOptions>,
): Promise<PollinationsResult> {
  // Pollinations API supports models: flux, zimage, turbo, gptimage, gptimage-large, kontext, seedream, seedream-pro, nanobanana, nanobanana-pro
  const encodedPrompt = encodeURIComponent(prompt);

  // Build URL with query parameters matching the gen.pollinations.ai API format
  const params = new URLSearchParams();

  // Model selection (default: zimage per API docs)
  params.set("model", model);
  params.set("width", width.toString());
  params.set("height", height.toString());

  // Add seed (0 for random, or specific value)
  params.set("seed", seed === -1 ? "0" : seed.toString());

  // Enhance mode - set to false for faster generation
  params.set("enhance", options?.enhance === true ? "true" : "false");

  // Default negative prompt for better quality images
  const defaultNegativePrompt = "worst quality, blurry";
  params.set("negative_prompt", options?.negativePrompt || defaultNegativePrompt);

  // Safe mode is configurable - defaults to false for creative freedom
  params.set("safe", options?.safe === true ? "true" : "false");

  // Use gen.pollinations.ai for authenticated requests when API key is provided
  // Supports sk_ format API keys for the new authenticated endpoint
  const useAuthenticatedEndpoint = !!apiKey;

  let url: string;
  if (useAuthenticatedEndpoint) {
    // Authenticated endpoint - higher rate limits, priority queue
    url = `https://gen.pollinations.ai/image/${encodedPrompt}?${params.toString()}`;
  } else {
    // Public endpoint - free, no auth required, may have rate limits
    url = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`;
  }

  logInfo("image", `Pollinations generating image`, { model, authenticated: useAuthenticatedEndpoint, width, height });

  return withRetry(
    async () => {
      const headers: Record<string, string> = {
        Accept: "image/jpeg",
      };

      // Use Authorization header for authenticated requests (secure, not logged in URLs)
      if (useAuthenticatedEndpoint && apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `Pollinations API error: ${response.status} ${response.statusText} - ${errorBody}`,
        );
      }

      // Get the image buffer directly
      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      logInfo("image", `Pollinations image generated successfully`, { size: imageBuffer.length, model });

      return { imageBuffer, url };
    },
    {
      maxRetries: 3,
      initialDelayMs: 2000,
      retryableErrors: [429, 500, 502, 503, 504],
    },
    `Pollinations (${model})`
  );
}



// More accurate interface based on usage
interface RunPodStatusResponse {
  id: string;
  status: "COMPLETED" | "FAILED" | "IN_PROGRESS" | "IN_QUEUE";
  output?: {
    image_url?: string;
  } | string[]; // output might be object with image_url or array of strings
  error?: string;
}

/**
 * Generates an image using a custom Stable Diffusion model hosted on RunPod.
 * 
 * @param prompt - The image prompt
 * @param apiKey - RunPod API key
 * @param width - Image width
 * @param height - Image height
 * @param seed - Random seed
 * @returns URL of the generated image
 */
export async function generateImageWithRunPod(
  prompt: string,
  apiKey: string,
  width: number = 1024,
  height: number = 576,
  seed: number = -1,
): Promise<string> {
  const endpoint = "f6uy7sz9cuve3f";
  const url = `https://api.runpod.io/v2/${endpoint}/run`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // RunPod size mapping for consistent resolutions
  const aspectRatio = width / height;
  let finalWidth: number;
  let finalHeight: number;

  if (aspectRatio < 1) {
    // Vertical/Portrait - use 720x1280 for RunPod
    finalWidth = 720;
    finalHeight = 1280;
  } else if (aspectRatio > 1) {
    // Horizontal/Landscape - use 1280x720 for RunPod
    finalWidth = 1280;
    finalHeight = 720;
  } else {
    // Square
    finalWidth = 1024;
    finalHeight = 1024;
  }

  const payload = {
    input: {
      prompt: prompt,
      seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed,
      guidance: 3.5,
      width: finalWidth,
      height: finalHeight,
    },
  };

  return withRetry(
    async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`RunPod API error: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as { id: string };
      const jobId = result.id;

      // Poll for completion
      for (let i = 0; i < 120; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusResponse = await fetch(
          `https://api.runpod.io/v2/${endpoint}/status/${jobId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
        );

        const statusResult = (await statusResponse.json()) as RunPodStatusResponse;

        if (statusResult.status === "COMPLETED") {
          const imageUrl = Array.isArray(statusResult.output)
            ? statusResult.output[0]
            : statusResult.output?.image_url;
          if (imageUrl) {
            logInfo("image", `RunPod image generated successfully`, { jobId });
            return imageUrl;
          }
        } else if (statusResult.status === "FAILED") {
          throw new Error(`RunPod generation failed: ${statusResult.error}`);
        }
      }

      throw new Error("RunPod generation timeout");
    },
    {
      maxRetries: 3,
      initialDelayMs: 2000,
      retryableErrors: [429, 500, 502, 503, 504],
    },
    "RunPod"
  );
}
