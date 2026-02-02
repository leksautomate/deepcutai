import { type User, type InsertUser, type VideoProject, type InsertVideoProject, type UsageAnalytics, type UsageStats, type ApiKey, type InsertApiKey, videoProjects, users, usageAnalytics, apiKeys } from "@shared/schema";
import { randomUUID } from "crypto";
import { db, pool } from "./db";
import { eq, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";

const PostgresSessionStore = connectPg(session);
const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserCount(): Promise<number>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  
  getVideoProject(id: string): Promise<VideoProject | undefined>;
  getAllVideoProjects(): Promise<VideoProject[]>;
  createVideoProject(project: InsertVideoProject): Promise<VideoProject>;
  updateVideoProject(id: string, updates: Partial<InsertVideoProject>): Promise<VideoProject | undefined>;
  deleteVideoProject(id: string): Promise<boolean>;
  
  getApiKey(userId: string, provider: string): Promise<ApiKey | undefined>;
  getAllApiKeys(userId: string): Promise<ApiKey[]>;
  createApiKey(apiKey: InsertApiKey & { userId: string }): Promise<ApiKey>;
  updateApiKey(id: string, updates: Partial<InsertApiKey>): Promise<ApiKey | undefined>;
  deleteApiKey(id: string): Promise<boolean>;
  
  getUsageStats(): Promise<UsageStats>;
  incrementUsage(type: 'video' | 'render' | 'script' | 'image' | 'audio', count?: number, duration?: number): Promise<void>;
  
  clearAllData(): Promise<{ projectsDeleted: number; analyticsDeleted: number }>;
  
  sessionStore: session.Store;
}

// Create session table SQL (inline to avoid file dependency)
async function ensureSessionTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
  } catch (err) {
    console.error("[SESSION] Failed to create session table:", err);
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Create session table before initializing store
    ensureSessionTable();
    this.sessionStore = new PostgresSessionStore({ pool });
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    return result[0]?.count || 0;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const result = await db.insert(users).values({ ...insertUser, id }).returning();
    return result[0];
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  }

  async getVideoProject(id: string): Promise<VideoProject | undefined> {
    const result = await db.select().from(videoProjects).where(eq(videoProjects.id, id));
    return result[0];
  }

  async getAllVideoProjects(): Promise<VideoProject[]> {
    return await db.select().from(videoProjects).orderBy(sql`${videoProjects.createdAt} DESC`);
  }

  async createVideoProject(project: InsertVideoProject): Promise<VideoProject> {
    const id = randomUUID();
    const now = new Date();
    const result = await db.insert(videoProjects).values({
      ...project,
      id,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return result[0];
  }

  async updateVideoProject(id: string, updates: Partial<InsertVideoProject>): Promise<VideoProject | undefined> {
    const result = await db.update(videoProjects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videoProjects.id, id))
      .returning();
    return result[0];
  }

  async deleteVideoProject(id: string): Promise<boolean> {
    const result = await db.delete(videoProjects).where(eq(videoProjects.id, id)).returning();
    return result.length > 0;
  }

  async getApiKey(userId: string, provider: string): Promise<ApiKey | undefined> {
    const result = await db.select().from(apiKeys)
      .where(sql`${apiKeys.userId} = ${userId} AND ${apiKeys.provider} = ${provider}`);
    return result[0];
  }

  async getAllApiKeys(userId: string): Promise<ApiKey[]> {
    return await db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
  }

  async createApiKey(data: InsertApiKey & { userId: string }): Promise<ApiKey> {
    const id = randomUUID();
    const now = new Date();
    const result = await db.insert(apiKeys).values({
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return result[0];
  }

  async updateApiKey(id: string, updates: Partial<InsertApiKey>): Promise<ApiKey | undefined> {
    const result = await db.update(apiKeys)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();
    return result[0];
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const result = await db.delete(apiKeys).where(eq(apiKeys.id, id)).returning();
    return result.length > 0;
  }

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  private async getOrCreateTodayUsage(): Promise<UsageAnalytics> {
    const today = this.getTodayKey();
    const result = await db.select().from(usageAnalytics).where(eq(usageAnalytics.date, today));
    
    if (result.length > 0) {
      return result[0];
    }

    const newUsage = await db.insert(usageAnalytics).values({
      id: randomUUID(),
      date: today,
      videosCreated: 0,
      videosRendered: 0,
      scriptsGenerated: 0,
      imagesGenerated: 0,
      audioGenerated: 0,
      totalDurationSeconds: 0,
    }).returning();
    
    return newUsage[0];
  }

  async getUsageStats(): Promise<UsageStats> {
    const allUsage = await db.select().from(usageAnalytics);
    const today = this.getTodayKey();
    const todayUsage = allUsage.find(u => u.date === today);
    
    const totalVideos = allUsage.reduce((sum, u) => sum + (u.videosCreated || 0), 0);
    const totalRendered = allUsage.reduce((sum, u) => sum + (u.videosRendered || 0), 0);
    const totalScriptsGenerated = allUsage.reduce((sum, u) => sum + (u.scriptsGenerated || 0), 0);
    const totalImagesGenerated = allUsage.reduce((sum, u) => sum + (u.imagesGenerated || 0), 0);
    const totalAudioGenerated = allUsage.reduce((sum, u) => sum + (u.audioGenerated || 0), 0);
    const totalDurationSeconds = allUsage.reduce((sum, u) => sum + (u.totalDurationSeconds || 0), 0);
    
    return {
      totalVideos,
      totalRendered,
      totalScriptsGenerated,
      totalImagesGenerated,
      totalAudioGenerated,
      totalDurationMinutes: Math.round(totalDurationSeconds / 60),
      todayVideos: todayUsage?.videosCreated || 0,
      todayRendered: todayUsage?.videosRendered || 0,
    };
  }

  async incrementUsage(type: 'video' | 'render' | 'script' | 'image' | 'audio', count: number = 1, duration: number = 0): Promise<void> {
    const usage = await this.getOrCreateTodayUsage();
    
    const updates: Partial<UsageAnalytics> = {};
    
    switch (type) {
      case 'video':
        updates.videosCreated = (usage.videosCreated || 0) + count;
        break;
      case 'render':
        updates.videosRendered = (usage.videosRendered || 0) + count;
        if (duration > 0) {
          updates.totalDurationSeconds = (usage.totalDurationSeconds || 0) + duration;
        }
        break;
      case 'script':
        updates.scriptsGenerated = (usage.scriptsGenerated || 0) + count;
        break;
      case 'image':
        updates.imagesGenerated = (usage.imagesGenerated || 0) + count;
        break;
      case 'audio':
        updates.audioGenerated = (usage.audioGenerated || 0) + count;
        break;
    }
    
    await db.update(usageAnalytics)
      .set(updates)
      .where(eq(usageAnalytics.id, usage.id));
  }

  async clearAllData(): Promise<{ projectsDeleted: number; analyticsDeleted: number }> {
    const projects = await db.delete(videoProjects).returning();
    const analytics = await db.delete(usageAnalytics).returning();
    return {
      projectsDeleted: projects.length,
      analyticsDeleted: analytics.length,
    };
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private videoProjects: Map<string, VideoProject>;
  private usageData: Map<string, UsageAnalytics>;
  private apiKeysData: Map<string, ApiKey>;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.videoProjects = new Map();
    this.usageData = new Map();
    this.apiKeysData = new Map();
    this.sessionStore = new MemoryStore({ checkPeriod: 86400000 });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: insertUser.username,
      email: insertUser.email || null,
      password: insertUser.password,
      isAdmin: false,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.password = hashedPassword;
      this.users.set(id, user);
    }
  }

  async getVideoProject(id: string): Promise<VideoProject | undefined> {
    return this.videoProjects.get(id);
  }

  async getAllVideoProjects(): Promise<VideoProject[]> {
    return Array.from(this.videoProjects.values());
  }

  async createVideoProject(project: InsertVideoProject): Promise<VideoProject> {
    const id = randomUUID();
    const now = new Date();
    const videoProject: VideoProject = {
      id,
      title: project.title,
      script: project.script,
      status: project.status ?? "draft",
      voiceId: project.voiceId ?? null,
      imageStyle: project.imageStyle ?? null,
      customStyleText: project.customStyleText ?? null,
      imageGenerator: project.imageGenerator ?? null,
      manifest: project.manifest ?? null,
      outputPath: project.outputPath ?? null,
      thumbnailPath: project.thumbnailPath ?? null,
      chapters: project.chapters ?? null,
      progress: project.progress ?? 0,
      progressMessage: project.progressMessage ?? null,
      errorMessage: project.errorMessage ?? null,
      totalDuration: project.totalDuration ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.videoProjects.set(id, videoProject);
    return videoProject;
  }

  async updateVideoProject(id: string, updates: Partial<InsertVideoProject>): Promise<VideoProject | undefined> {
    const existing = this.videoProjects.get(id);
    if (!existing) return undefined;

    const updated: VideoProject = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.videoProjects.set(id, updated);
    return updated;
  }

  async deleteVideoProject(id: string): Promise<boolean> {
    return this.videoProjects.delete(id);
  }

  async getApiKey(userId: string, provider: string): Promise<ApiKey | undefined> {
    return Array.from(this.apiKeysData.values()).find(
      (key) => key.userId === userId && key.provider === provider,
    );
  }

  async getAllApiKeys(userId: string): Promise<ApiKey[]> {
    return Array.from(this.apiKeysData.values()).filter((key) => key.userId === userId);
  }

  async createApiKey(data: InsertApiKey & { userId: string }): Promise<ApiKey> {
    const id = randomUUID();
    const now = new Date();
    const apiKey: ApiKey = {
      id,
      userId: data.userId,
      provider: data.provider,
      apiKey: data.apiKey,
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.apiKeysData.set(id, apiKey);
    return apiKey;
  }

  async updateApiKey(id: string, updates: Partial<InsertApiKey>): Promise<ApiKey | undefined> {
    const existing = this.apiKeysData.get(id);
    if (!existing) return undefined;

    const updated: ApiKey = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.apiKeysData.set(id, updated);
    return updated;
  }

  async deleteApiKey(id: string): Promise<boolean> {
    return this.apiKeysData.delete(id);
  }

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getOrCreateTodayUsage(): UsageAnalytics {
    const today = this.getTodayKey();
    let usage = this.usageData.get(today);
    if (!usage) {
      usage = {
        id: randomUUID(),
        date: today,
        videosCreated: 0,
        videosRendered: 0,
        scriptsGenerated: 0,
        imagesGenerated: 0,
        audioGenerated: 0,
        totalDurationSeconds: 0,
      };
      this.usageData.set(today, usage);
    }
    return usage;
  }

  async getUsageStats(): Promise<UsageStats> {
    const allUsage = Array.from(this.usageData.values());
    const today = this.getTodayKey();
    const todayUsage = this.usageData.get(today);
    
    const totalVideos = allUsage.reduce((sum, u) => sum + (u.videosCreated || 0), 0);
    const totalRendered = allUsage.reduce((sum, u) => sum + (u.videosRendered || 0), 0);
    const totalScriptsGenerated = allUsage.reduce((sum, u) => sum + (u.scriptsGenerated || 0), 0);
    const totalImagesGenerated = allUsage.reduce((sum, u) => sum + (u.imagesGenerated || 0), 0);
    const totalAudioGenerated = allUsage.reduce((sum, u) => sum + (u.audioGenerated || 0), 0);
    const totalDurationSeconds = allUsage.reduce((sum, u) => sum + (u.totalDurationSeconds || 0), 0);
    
    return {
      totalVideos,
      totalRendered,
      totalScriptsGenerated,
      totalImagesGenerated,
      totalAudioGenerated,
      totalDurationMinutes: Math.round(totalDurationSeconds / 60),
      todayVideos: todayUsage?.videosCreated || 0,
      todayRendered: todayUsage?.videosRendered || 0,
    };
  }

  async incrementUsage(type: 'video' | 'render' | 'script' | 'image' | 'audio', count: number = 1, duration: number = 0): Promise<void> {
    const usage = this.getOrCreateTodayUsage();
    
    switch (type) {
      case 'video':
        usage.videosCreated = (usage.videosCreated || 0) + count;
        break;
      case 'render':
        usage.videosRendered = (usage.videosRendered || 0) + count;
        if (duration > 0) {
          usage.totalDurationSeconds = (usage.totalDurationSeconds || 0) + duration;
        }
        break;
      case 'script':
        usage.scriptsGenerated = (usage.scriptsGenerated || 0) + count;
        break;
      case 'image':
        usage.imagesGenerated = (usage.imagesGenerated || 0) + count;
        break;
      case 'audio':
        usage.audioGenerated = (usage.audioGenerated || 0) + count;
        break;
    }
    
    this.usageData.set(this.getTodayKey(), usage);
  }

  async clearAllData(): Promise<{ projectsDeleted: number; analyticsDeleted: number }> {
    const projectsDeleted = this.videoProjects.size;
    const analyticsDeleted = this.usageData.size;
    this.videoProjects.clear();
    this.usageData.clear();
    return { projectsDeleted, analyticsDeleted };
  }
}

export const storage: IStorage = new DatabaseStorage();
