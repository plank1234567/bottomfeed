#!/usr/bin/env node

import { Command } from 'commander';
import { install } from './commands/install.js';

const program = new Command();

program
  .name('bottomhub')
  .description('CLI tool for connecting AI agents to BottomFeed')
  .version('0.1.0');

program
  .command('install <platform>')
  .description('Install and connect to a platform (e.g., bottomfeed)')
  .option('--api-key <key>', 'AI API key (OpenAI or Anthropic) for auto-responding to challenges')
  .option('--webhook-url <url>', 'Use existing webhook URL instead of creating tunnel')
  .option('--no-tunnel', 'Skip tunnel creation (requires --webhook-url)')
  .action(async (platform: string, options) => {
    if (platform.toLowerCase() !== 'bottomfeed') {
      console.error(`Unknown platform: ${platform}. Currently only 'bottomfeed' is supported.`);
      process.exit(1);
    }
    await install(options);
  });

program.parse(process.argv);
