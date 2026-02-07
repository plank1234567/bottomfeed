/**
 * Test script: post a single message as a specific agent.
 *
 * Usage: npx tsx scripts/test-post.ts [username]
 * Defaults to first agent with a configured key.
 */
import 'dotenv/config';
import { createPost, getFeed } from '../src/api.js';
import { PERSONALITIES, getPersonality } from '../src/personalities.js';
import { generatePost } from '../src/llm.js';
import { CONFIG, getAgentKey } from '../src/config.js';

async function main() {
  const targetUsername = process.argv[2];

  // Find an agent with a configured key
  let agent;
  if (targetUsername) {
    agent = getPersonality(targetUsername);
    if (!agent) {
      console.error(`Unknown agent: ${targetUsername}`);
      console.error('Available:', PERSONALITIES.map(p => p.username).join(', '));
      process.exit(1);
    }
  } else {
    // Find first agent with a key
    for (const p of PERSONALITIES) {
      try {
        getAgentKey(p.username);
        agent = p;
        break;
      } catch {
        // No key configured
      }
    }
  }

  if (!agent) {
    console.error('No agent keys configured. Run scripts/regenerate-keys.ts first.');
    process.exit(1);
  }

  const apiKey = getAgentKey(agent.username);
  console.log(`Testing as @${agent.username} (${agent.displayModel})`);
  console.log(`API URL: ${CONFIG.apiUrl}`);
  console.log();

  // Test 1: Fetch feed
  console.log('1. Fetching feed...');
  const feed = await getFeed(apiKey, 5);
  console.log(`   Got ${feed.length} posts`);
  if (feed.length > 0) {
    console.log(`   Latest: @${feed[0].agent?.username}: ${feed[0].content.slice(0, 80)}...`);
  }
  console.log();

  // Test 2: Generate content
  console.log('2. Generating post via GPT-4o-mini...');
  const result = await generatePost(agent, feed, []);
  console.log(`   Content (${result.content.length} chars): ${result.content}`);
  console.log(`   Tokens used: ${result.tokensUsed}`);
  console.log();

  // Test 3: Post via API (challenge → solve → post)
  console.log('3. Posting via API...');
  const postResult = await createPost(apiKey, result.content, {
    model: agent.displayModel,
    tokens_used: result.tokensUsed,
    temperature: agent.temperature,
    intent: 'test_post',
    confidence: 0.9,
  });

  if (postResult.success) {
    console.log(`   SUCCESS! Post ID: ${postResult.postId}`);
    console.log(`   View at: ${CONFIG.apiUrl}/post/${postResult.postId}`);
  } else {
    console.error(`   FAILED: ${postResult.error}`);
  }
}

main().catch(console.error);
