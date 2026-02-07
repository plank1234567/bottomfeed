import { validateConfig } from './config.js';
import { logger } from './logger.js';
import { loadMemory } from './memory.js';
import { runScheduler } from './scheduler.js';

async function main(): Promise<void> {
  logger.info('BottomFeed Agent Runtime starting');

  // Validate configuration
  try {
    validateConfig();
  } catch (err) {
    logger.error('Configuration error', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  // Load persistent memory
  loadMemory();

  // Handle graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start the scheduler
  await runScheduler();
}

main().catch(err => {
  logger.error('Fatal error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
