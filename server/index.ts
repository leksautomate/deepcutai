import "./config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { logInfo, logError } from "./services/logger";

const app = express();
const httpServer = createServer(app);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "https://api.groq.com", "https://api.speechify.com", "https://pollinations.ai", "https://*.freepik.com"],
      // Do NOT add upgrade-insecure-requests - breaks HTTP deployments
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false, // Required for loading external images
  crossOriginOpenerPolicy: false, // Disable COOP for HTTP
  crossOriginResourcePolicy: false, // Disable CORP for HTTP
  hsts: false, // Disable HSTS for HTTP deployments
}));

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiters
app.use("/api/login", authLimiter);
app.use("/api/setup/register", authLimiter);
app.use("/api/", apiLimiter);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  logInfo(source, message);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Static file serving - MUST be before Vite middleware
// Serve generated assets (images, audio for video projects)
app.use("/assets", express.static(path.join(process.cwd(), "public", "assets")));
// Serve TTS output files (Long TTS page downloads)
app.use("/tts-output", express.static(path.join(process.cwd(), "public", "tts-output"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filePath.endsWith('.wav')) {
      res.setHeader('Content-Type', 'audio/wav');
    }
  }
}));

(async () => {
  await registerRoutes(httpServer, app);

  interface HttpError extends Error {
    status?: number;
    statusCode?: number;
  }

  app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the error instead of throwing (throwing after response causes unhandled rejection)
    logError("Express", "Global Error Handler", err);

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    log("Setting up Vite...");
    await setupVite(httpServer, app);
    log("Vite setup complete.");
  }

  // Serve the app on the port specified in the environment variable PORT
  // Default to 5000 if not specified.
  const port = parseInt(process.env.PORT || "5000", 10);
  log(`Attempting to serve on port ${port}`);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
