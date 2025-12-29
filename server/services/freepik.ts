import * as fs from "fs";
import * as path from "path";

const FREEPIK_API_URL = "https://api.freepik.com/v1";

export interface ImageGenerationOptions {
  prompt: string;
  outputPath: string;
  width?: number;
  height?: number;
  style?: string;
  aspectRatio?: string;
}

export interface ImageGenerationResult {
  imagePath: string;
  success: boolean;
  error?: string;
}

function getAspectRatio(width?: number, height?: number): string {
  if (!width || !height) return "widescreen_16_9";
  
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.1) return "square_1_1";
  if (Math.abs(ratio - 16/9) < 0.1) return "widescreen_16_9";
  if (Math.abs(ratio - 9/16) < 0.1) return "social_story_9_16";
  if (Math.abs(ratio - 4/3) < 0.1) return "classic_4_3";
  if (Math.abs(ratio - 3/4) < 0.1) return "traditional_3_4";
  if (Math.abs(ratio - 3/2) < 0.1) return "standard_3_2";
  if (Math.abs(ratio - 2/3) < 0.1) return "portrait_2_3";
  
  return ratio > 1 ? "widescreen_16_9" : "social_story_9_16";
}

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Failed to download image:", response.status);
      return false;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (error) {
    console.error("Image download error:", error);
    return false;
  }
}

async function pollTaskStatus(taskId: string, apiKey: string, maxAttempts: number = 30): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${FREEPIK_API_URL}/ai/text-to-image/seedream-v4/${taskId}`, {
        method: "GET",
        headers: {
          "x-freepik-api-key": apiKey,
        },
      });

      if (!response.ok) {
        console.error("Freepik poll error:", response.status);
        return null;
      }

      const data = await response.json();
      console.log(`Seedream v4 task ${taskId} status: ${data.data?.status}`);

      if (data.data?.status === "COMPLETED" && data.data?.generated?.length > 0) {
        return data.data.generated[0];
      }

      if (data.data?.status === "FAILED") {
        console.error("Seedream v4 task failed");
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error("Polling error:", error);
      return null;
    }
  }
  
  console.error("Seedream v4 task timed out");
  return null;
}

export async function generateImageWithSeestream(options: ImageGenerationOptions & { apiKey?: string }): Promise<ImageGenerationResult> {
  const { prompt, outputPath, width, height, style = "cinematic", apiKey: providedApiKey } = options;
  const apiKey = providedApiKey || process.env.FREEPIK_API_KEY;

  if (!apiKey) {
    console.warn("Freepik/Seedream API key not found. Save your API key in Settings > Configure Keys.");
    return {
      imagePath: "",
      success: false,
      error: "API key not configured",
    };
  }

  const aspectRatio = getAspectRatio(width, height);
  const enhancedPrompt = `${prompt}, ${style} style, high quality, detailed, cinematic lighting, professional composition`;

  try {
    console.log(`Starting Seedream v4 generation with aspect ratio: ${aspectRatio}`);
    
    const response = await fetch(`${FREEPIK_API_URL}/ai/text-to-image/seedream-v4`, {
      method: "POST",
      headers: {
        "x-freepik-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        aspect_ratio: aspectRatio,
        guidance_scale: 2.5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Freepik Seedream v4 API error:", response.status, errorText);
      return {
        imagePath: "",
        success: false,
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    console.log("Seedream v4 initial response:", JSON.stringify(data, null, 2));

    if (data.data?.task_id) {
      const imageUrl = await pollTaskStatus(data.data.task_id, apiKey);
      
      if (imageUrl) {
        const downloaded = await downloadImage(imageUrl, outputPath);
        if (downloaded) {
          console.log(`Image saved to: ${outputPath}`);
          return { imagePath: outputPath, success: true };
        }
      }
    }

    if (data.data?.generated && data.data.generated.length > 0) {
      const imageUrl = data.data.generated[0];
      const downloaded = await downloadImage(imageUrl, outputPath);
      if (downloaded) {
        return { imagePath: outputPath, success: true };
      }
    }

    console.error("No image generated from Seedream v4");
    return {
      imagePath: "",
      success: false,
      error: "No image generated",
    };
  } catch (error) {
    console.error("Seedream v4 generation error:", error);
    return {
      imagePath: "",
      success: false,
      error: String(error),
    };
  }
}

export async function generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
  return generateImageWithSeestream(options);
}
