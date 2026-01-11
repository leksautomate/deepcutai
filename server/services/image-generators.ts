import fetch from "node-fetch";

export async function generateImageWithWaveSpeed(
  prompt: string,
  apiKey: string,
  width: number = 1024,
  height: number = 576,
  seed: number = -1
): Promise<string> {
  const url = "https://api.wavespeed.ai/api/v3/wavespeed-ai/z-image/turbo";
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`WaveSpeed API error: ${response.status}`);
    }

    const result = await response.json() as any;
    const requestId = result.data.id;

    // Poll for completion
    for (let i = 0; i < 120; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusResponse = await fetch(
        `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`,
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
          },
        }
      );

      const statusResult = await statusResponse.json() as any;

      if (statusResponse.ok) {
        const data = statusResult.data;
        const status = data.status;

        if (status === "completed") {
          return data.outputs[0];
        } else if (status === "failed") {
          throw new Error(`WaveSpeed generation failed: ${data.error}`);
        }
      }
    }

    throw new Error("WaveSpeed generation timeout");
  } catch (error) {
    throw new Error(`WaveSpeed request failed: ${error}`);
  }
}

export interface PollinationsResult {
  imageBuffer: Buffer;
  url: string;
}

export async function generateImageWithPollinations(
  prompt: string,
  apiKey: string | null,
  width: number = 1024,
  height: number = 576,
  model: string = "flux",
  seed: number = -1
): Promise<PollinationsResult> {
  // Pollinations API supports models: flux, zimage, turbo, gptimage, gptimage-large, kontext, seedream, seedream-pro, nanobanana, nanobanana-pro
  const encodedPrompt = encodeURIComponent(prompt);
  
  // Build URL with query parameters - use image.pollinations.ai endpoint
  const params = new URLSearchParams({
    model: model,
    width: width.toString(),
    height: height.toString(),
    nologo: "true",
    enhance: "true",
  });
  
  // Only add seed if not random
  if (seed !== -1) {
    params.set("seed", seed.toString());
  }
  
  // Add API key as query param if provided
  if (apiKey) {
    params.set("key", apiKey);
  }
  
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Pollinations API error: ${response.status} ${response.statusText}`);
    }

    // Get the image buffer directly
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    
    return { imageBuffer, url };
  } catch (error) {
    throw new Error(`Pollinations request failed: ${error}`);
  }
}

export async function generateImageWithRunPod(
  prompt: string,
  apiKey: string,
  width: number = 1024,
  height: number = 576,
  seed: number = -1
): Promise<string> {
  const endpoint = "f6uy7sz9cuve3f";
  const url = `https://api.runpod.io/v2/${endpoint}/run`;

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`RunPod API error: ${response.status}`);
    }

    const result = await response.json() as any;
    const jobId = result.id;

    // Poll for completion
    for (let i = 0; i < 120; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await fetch(
        `https://api.runpod.io/v2/${endpoint}/status/${jobId}`,
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
          },
        }
      );

      const statusResult = await statusResponse.json() as any;

      if (statusResult.status === "COMPLETED") {
        const imageUrl = statusResult.output?.image_url || statusResult.output?.[0];
        if (imageUrl) {
          return imageUrl;
        }
      } else if (statusResult.status === "FAILED") {
        throw new Error(`RunPod generation failed: ${statusResult.error}`);
      }
    }

    throw new Error("RunPod generation timeout");
  } catch (error) {
    throw new Error(`RunPod request failed: ${error}`);
  }
}
