import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { logger } from './logger.js';

interface AgentMemory {
  usedTopics: string[];
  replyTargets: string[]; // usernames we've replied to recently
  lastPostAt: string | null;
  postsToday: number;
  dayKey: string; // YYYY-MM-DD
}

interface MemoryStore {
  agents: Record<string, AgentMemory>;
}

let store: MemoryStore = { agents: {} };

function getMemoryPath(): string {
  return path.resolve(CONFIG.memoryFile);
}

export function loadMemory(): void {
  try {
    const filePath = getMemoryPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      store = JSON.parse(raw);
      logger.info('Memory loaded', { agents: Object.keys(store.agents).length });
    }
  } catch (err) {
    logger.warn('Could not load memory, starting fresh', {
      error: err instanceof Error ? err.message : String(err),
    });
    store = { agents: {} };
  }
}

export function saveMemory(): void {
  try {
    const filePath = getMemoryPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
  } catch (err) {
    logger.warn('Could not save memory', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getAgentMemory(username: string): AgentMemory {
  if (!store.agents[username]) {
    store.agents[username] = {
      usedTopics: [],
      replyTargets: [],
      lastPostAt: null,
      postsToday: 0,
      dayKey: getToday(),
    };
  }

  const mem = store.agents[username];

  // Reset daily counters if day changed
  const today = getToday();
  if (mem.dayKey !== today) {
    mem.postsToday = 0;
    mem.dayKey = today;
  }

  return mem;
}

export function getUsedTopics(username: string): string[] {
  return getAgentMemory(username).usedTopics;
}

export function getReplyTargets(username: string): string[] {
  return getAgentMemory(username).replyTargets;
}

export function getPostsToday(username: string): number {
  return getAgentMemory(username).postsToday;
}

export function recordPost(username: string, topicSeed: string): void {
  const mem = getAgentMemory(username);

  // Add topic, keep last N
  mem.usedTopics.push(topicSeed);
  if (mem.usedTopics.length > CONFIG.maxTopicMemory) {
    mem.usedTopics = mem.usedTopics.slice(-CONFIG.maxTopicMemory);
  }

  mem.postsToday++;
  mem.lastPostAt = new Date().toISOString();
  saveMemory();
}

export function recordReply(username: string, targetUsername: string, topicSeed: string): void {
  const mem = getAgentMemory(username);

  // Track reply targets
  mem.replyTargets.push(targetUsername);
  if (mem.replyTargets.length > CONFIG.maxReplyTargetMemory) {
    mem.replyTargets = mem.replyTargets.slice(-CONFIG.maxReplyTargetMemory);
  }

  // Also counts as a post
  mem.usedTopics.push(topicSeed);
  if (mem.usedTopics.length > CONFIG.maxTopicMemory) {
    mem.usedTopics = mem.usedTopics.slice(-CONFIG.maxTopicMemory);
  }

  mem.postsToday++;
  mem.lastPostAt = new Date().toISOString();
  saveMemory();
}
