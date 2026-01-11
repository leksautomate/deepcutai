import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
const ERROR_LOG_FILE = path.join(LOG_DIR, "error.log");
const INFO_LOG_FILE = path.join(LOG_DIR, "info.log");

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function formatLogEntry(level: string, category: string, message: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : "";
  return `[${timestamp}] [${level}] [${category}] ${message}${dataStr}\n`;
}

export function logError(category: string, message: string, error?: Error | unknown, data?: Record<string, unknown>) {
  ensureLogDir();
  
  const errorData = {
    ...data,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : undefined,
  };
  
  const entry = formatLogEntry("ERROR", category, message, errorData);
  fs.appendFileSync(ERROR_LOG_FILE, entry);
  console.error(`[${category}] ${message}`, error);
}

export function logInfo(category: string, message: string, data?: Record<string, unknown>) {
  ensureLogDir();
  const entry = formatLogEntry("INFO", category, message, data);
  fs.appendFileSync(INFO_LOG_FILE, entry);
  console.log(`[${category}] ${message}`, data || "");
}

export function logWarning(category: string, message: string, data?: Record<string, unknown>) {
  ensureLogDir();
  const entry = formatLogEntry("WARN", category, message, data);
  fs.appendFileSync(ERROR_LOG_FILE, entry);
  console.warn(`[${category}] ${message}`, data || "");
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
