import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { logInfo, logError, logWarning } from "./services/logger";

declare global {
  namespace Express {
    interface User extends SelectUser { }
  }
}

// Authentication middleware - use this to protect routes
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated() || !req.user) {
    logWarning("Auth", `Unauthorized access to ${req.path}`, { sessionID: req.sessionID, hasUser: !!req.user, isAuth: req.isAuthenticated() });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ... (skip to passport config)



// Optional auth - doesn't fail but populates req.user if available
export function optionalAuth(_req: Request, _res: Response, next: NextFunction): void {
  // Just continue - session middleware already populates req.user if authenticated
  next();
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

import { getSecret, getRequiredSecret } from "./utils/secrets";

async function checkAndCreateEnvAdmin() {
  const adminUsername = getSecret("admin_username", "ADMIN_USERNAME");
  const adminPassword = getSecret("admin_password", "ADMIN_PASSWORD");

  if (!adminUsername || !adminPassword) {
    return;
  }

  const userCount = await storage.getUserCount();
  if (userCount > 0) {
    logInfo("Auth", "Users exist, skipping env admin creation");
    return;
  }

  const hashedPassword = await hashPassword(adminPassword);
  await storage.createUser({
    username: adminUsername,
    email: getSecret("admin_email", "ADMIN_EMAIL") || null,
    password: hashedPassword,
  });
  logInfo("Auth", "Admin user created from environment variables");
}

export function setupAuth(app: Express) {
  const sessionSecret = getRequiredSecret("session_secret", "SESSION_SECRET");

  checkAndCreateEnvAdmin().catch((err) => {
    logError("Auth", "Failed to check/create admin user", err);
  });

  // Cookie secure setting:
  // - Default: false (works with HTTP)
  // - Set COOKIE_SECURE=true to enable (requires HTTPS/SSL)
  const cookieSecure = process.env.COOKIE_SECURE === "true";

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: cookieSecure,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        logWarning("Auth", `Deserialization failed: User ${id} not found in DB`);
        return done(null, false);
      }
      // console.log("[AUTH] Deserialized user:", user.username);
      done(null, user);
    } catch (err) {
      logError("Auth", "Deserialization error", err);
      done(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    const user = req.user as SelectUser;
    res.status(200).json({ id: user.id, username: user.username });
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res): void => {
    if (!req.isAuthenticated()) {
      res.sendStatus(401);
      return;
    }
    const user = req.user as SelectUser;
    res.json({ id: user.id, username: user.username });
  });
}
