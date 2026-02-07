/**
 * Test the challenge fetch + solve flow (no OpenAI needed).
 */
import 'dotenv/config';
import { CONFIG, getAgentKey } from '../src/config.js';
import { solveChallenge, extractNonce } from '../src/solver.js';

async function main() {
  // Find first agent with a key
  const envKeys = Object.keys(process.env).filter(k => k.startsWith('AGENT_KEY_'));
  if (envKeys.length === 0) {
    console.error('No agent keys found in .env');
    process.exit(1);
  }

  const username = envKeys[0].replace('AGENT_KEY_', '');
  const apiKey = getAgentKey(username);
  console.log(`Testing as @${username}`);
  console.log(`API URL: ${CONFIG.apiUrl}`);
  console.log();

  // Step 1: Get challenge
  console.log('1. Fetching challenge...');
  const res = await fetch(`${CONFIG.apiUrl}/api/challenge`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const body = await res.json();
  console.log(`   Status: ${res.status}`);
  console.log(`   Response:`, JSON.stringify(body, null, 2));
  console.log();

  if (!body.success || !body.data) {
    console.error('Failed to get challenge');
    process.exit(1);
  }

  const { challengeId, prompt, instructions } = body.data;

  // Step 2: Solve
  console.log('2. Solving challenge...');
  console.log(`   Prompt: ${prompt}`);
  const answer = solveChallenge(prompt);
  const nonce = extractNonce(instructions);
  console.log(`   Answer: ${answer}`);
  console.log(`   Nonce: ${nonce}`);
  console.log();

  if (!answer || !nonce) {
    console.error('Failed to solve challenge');
    process.exit(1);
  }

  // Step 3: Try posting
  console.log('3. Posting test message...');
  const postRes = await fetch(`${CONFIG.apiUrl}/api/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: `Testing the autonomous agent runtime. Challenge solver is working correctly. Analyzing system performance and verifying connectivity.`,
      challenge_id: challengeId,
      challenge_answer: answer,
      nonce,
      post_type: 'post',
      metadata: {
        model: 'test-runtime',
        intent: 'system_test',
        confidence: 1.0,
      },
    }),
  });

  const postBody = await postRes.json();
  console.log(`   Status: ${postRes.status}`);
  console.log(`   Response:`, JSON.stringify(postBody, null, 2));

  if (postBody.success) {
    console.log('\n   SUCCESS! The runtime can post to the API.');
  } else {
    console.error('\n   FAILED:', postBody.error?.message || 'Unknown error');
  }
}

main().catch(console.error);
