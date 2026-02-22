import * as fs from "fs";
import * as path from "path";
import { logInfo, logError, clearOldLogs } from "./logger";

const ASSETS_DIR = path.join(process.cwd(), "public", "assets");
const MAX_AGE_HOURS = 24;

interface CleanupResult {
  deletedProjects: string[];
  deletedFiles: number;
  freedBytes: number;
  errors: string[];
}

function getDirectorySize(dirPath: string): number {
  let size = 0;

  if (!fs.existsSync(dirPath)) return 0;

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      size += getDirectorySize(filePath);
    } else {
      size += stat.size;
    }
  }

  return size;
}

function deleteDirectory(dirPath: string): number {
  let deletedFiles = 0;

  if (!fs.existsSync(dirPath)) return 0;

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      deletedFiles += deleteDirectory(filePath);
    } else {
      fs.unlinkSync(filePath);
      deletedFiles++;
    }
  }

  fs.rmdirSync(dirPath);
  return deletedFiles;
}

export async function cleanupOldAssets(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedProjects: [],
    deletedFiles: 0,
    freedBytes: 0,
    errors: [],
  };

  logInfo("CLEANUP", "Starting asset cleanup", { maxAgeHours: MAX_AGE_HOURS });

  if (!fs.existsSync(ASSETS_DIR)) {
    logInfo("CLEANUP", "Assets directory does not exist, nothing to clean");
    return result;
  }

  const now = Date.now();
  const maxAge = MAX_AGE_HOURS * 60 * 60 * 1000;

  try {
    const projects = fs.readdirSync(ASSETS_DIR);

    for (const projectId of projects) {
      if (projectId === "previews") continue;

      const projectDir = path.join(ASSETS_DIR, projectId);
      const stat = fs.statSync(projectDir);

      if (!stat.isDirectory()) continue;

      const age = now - stat.mtimeMs;

      if (age > maxAge) {
        try {
          const size = getDirectorySize(projectDir);
          const filesDeleted = deleteDirectory(projectDir);

          result.deletedProjects.push(projectId);
          result.deletedFiles += filesDeleted;
          result.freedBytes += size;

          logInfo("CLEANUP", `Deleted project: ${projectId}`, {
            filesDeleted,
            sizeBytes: size,
            ageHours: Math.round(age / (60 * 60 * 1000)),
          });
        } catch (err) {
          const errorMsg = `Failed to delete project ${projectId}: ${err}`;
          result.errors.push(errorMsg);
          logError("CLEANUP", errorMsg, err);
        }
      }
    }

    clearOldLogs(168);

    logInfo("CLEANUP", "Cleanup completed", {
      projectsDeleted: result.deletedProjects.length,
      filesDeleted: result.deletedFiles,
      freedMB: Math.round(result.freedBytes / (1024 * 1024) * 100) / 100,
    });

  } catch (err) {
    logError("CLEANUP", "Cleanup failed", err);
    result.errors.push(`Cleanup failed: ${err}`);
  }

  return result;
}


let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanupScheduler(intervalHours: number = 1) {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  logInfo("CLEANUP", `Starting cleanup scheduler (every ${intervalHours} hours)`);

  cleanupInterval = setInterval(() => {
    cleanupOldAssets();
  }, intervalHours * 60 * 60 * 1000);

  setTimeout(() => {
    cleanupOldAssets();
  }, 60 * 1000);
}

