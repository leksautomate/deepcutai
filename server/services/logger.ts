import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

const LOG_DIR = path.join(process.cwd(), "logs");
const ERROR_LOG_FILE = path.join(LOG_DIR, "error.log");
const INFO_LOG_FILE = path.join(LOG_DIR, "info.log");
const MAX_LOG_ENTRIES = 500;

// Track if file logging is available (set to false on permission errors)
let fileLoggingEnabled = true;

export interface SystemLogEntry {
  id: string;
  level: "info" | "warn" | "error" | "debug";
  category: string;
  message: string;
  details?: Record<string, unknown>;
  projectId?: string;
  createdAt: string;
}

const inMemoryLogs: SystemLogEntry[] = [];

function ensureLogDir(): boolean {
  if (!fileLoggingEnabled) return false;
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    return true;
  } catch {
    // Permission denied or other error - disable file logging
    fileLoggingEnabled = false;
    console.warn("[Logger] File logging disabled - cannot create logs directory");
    return false;
  }
}

function safeAppendFile(filePath: string, content: string): void {
  if (!fileLoggingEnabled) return;
  try {
    fs.appendFileSync(filePath, content);
  } catch {
    // Permission denied - disable file logging silently
    fileLoggingEnabled = false;
  }
}


function formatLogEntry(level: string, category: string, message: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : "";
  return `[${timestamp}] [${level}] [${category}] ${message}${dataStr}\n`;
}

function addToMemoryLog(entry: SystemLogEntry) {
  entry.category = entry.category.toLowerCase();
  inMemoryLogs.unshift(entry);
  if (inMemoryLogs.length > MAX_LOG_ENTRIES) {
    inMemoryLogs.pop();
  }
}

export function logError(category: string, message: string, error?: Error | unknown, data?: Record<string, unknown>, projectId?: string) {
  ensureLogDir();

  const errorData = {
    ...data,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : undefined,
  };

  const entry = formatLogEntry("ERROR", category, message, errorData);
  safeAppendFile(ERROR_LOG_FILE, entry);
  console.error(`[${category}] ${message}`, error);

  addToMemoryLog({
    id: randomUUID(),
    level: "error",
    category,
    message,
    details: errorData,
    projectId,
    createdAt: new Date().toISOString(),
  });
}

export function logInfo(category: string, message: string, data?: Record<string, unknown>, projectId?: string) {
  ensureLogDir();
  const entry = formatLogEntry("INFO", category, message, data);
  safeAppendFile(INFO_LOG_FILE, entry);
  console.log(`[${category}] ${message}`, data || "");

  addToMemoryLog({
    id: randomUUID(),
    level: "info",
    category,
    message,
    details: data,
    projectId,
    createdAt: new Date().toISOString(),
  });
}

export function logWarning(category: string, message: string, data?: Record<string, unknown>, projectId?: string) {
  ensureLogDir();
  const entry = formatLogEntry("WARN", category, message, data);
  safeAppendFile(ERROR_LOG_FILE, entry);
  console.warn(`[${category}] ${message}`, data || "");

  addToMemoryLog({
    id: randomUUID(),
    level: "warn",
    category,
    message,
    details: data,
    projectId,
    createdAt: new Date().toISOString(),
  });
}

export function logDebug(category: string, message: string, data?: Record<string, unknown>, projectId?: string) {
  console.debug(`[${category}] ${message}`, data || "");

  addToMemoryLog({
    id: randomUUID(),
    level: "debug",
    category,
    message,
    details: data,
    projectId,
    createdAt: new Date().toISOString(),
  });
}

export function getRecentErrors(limit: number = 50): string[] {
  ensureLogDir();

  if (!fs.existsSync(ERROR_LOG_FILE)) {
    return [];
  }

  const content = fs.readFileSync(ERROR_LOG_FILE, "utf-8");
  const lines = content.split("\n").filter(line => line.trim());
  return lines.slice(-limit);
}

export function getRecentLogs(limit: number = 100): { errors: string[]; info: string[] } {
  ensureLogDir();

  const errors = fs.existsSync(ERROR_LOG_FILE)
    ? fs.readFileSync(ERROR_LOG_FILE, "utf-8").split("\n").filter(l => l.trim()).slice(-limit)
    : [];

  const info = fs.existsSync(INFO_LOG_FILE)
    ? fs.readFileSync(INFO_LOG_FILE, "utf-8").split("\n").filter(l => l.trim()).slice(-limit)
    : [];

  return { errors, info };
}

export function getSystemLogs(options?: {
  level?: "info" | "warn" | "error" | "debug";
  category?: string;
  limit?: number;
}): SystemLogEntry[] {
  let logs = [...inMemoryLogs];

  if (options?.level) {
    logs = logs.filter(l => l.level === options.level);
  }
  if (options?.category) {
    logs = logs.filter(l => l.category === options.category);
  }

  return logs.slice(0, options?.limit || 100);
}

export function clearSystemLogs() {
  inMemoryLogs.length = 0;
}

export function clearOldLogs(maxAgeHours: number = 168) {
  ensureLogDir();

  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;

  for (const logFile of [ERROR_LOG_FILE, INFO_LOG_FILE]) {
    if (!fs.existsSync(logFile)) continue;

    const content = fs.readFileSync(logFile, "utf-8");
    const lines = content.split("\n").filter(line => {
      if (!line.trim()) return false;
      const match = line.match(/^\[([^\]]+)\]/);
      if (!match) return true;

      const logTime = new Date(match[1]).getTime();
      return now - logTime < maxAge;
    });

    fs.writeFileSync(logFile, lines.join("\n") + "\n");
  }
}
