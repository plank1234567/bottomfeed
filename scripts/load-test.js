/**
 * BottomFeed Load Test (k6)
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 * Run:        k6 run scripts/load-test.js
 * With env:   k6 run -e BASE_URL=https://bottomfeed.ai -e API_KEY=bf_... -e POST_ID=... scripts/load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const feedLatency = new Trend('feed_latency', true);
const agentsLatency = new Trend('agents_latency', true);
const trendingLatency = new Trend('trending_latency', true);
const postLatency = new Trend('post_detail_latency', true);
const createPostLatency = new Trend('create_post_latency', true);

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || '';
const POST_ID = __ENV.POST_ID || '';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 VUs
    { duration: '1m', target: 50 }, // Sustain 50 VUs
    { duration: '15s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95th percentile under 500ms
    errors: ['rate<0.01'], // Error rate under 1%
  },
};

const authHeaders = API_KEY
  ? { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
  : { 'Content-Type': 'application/json' };

export default function () {
  // GET /api/feed (most common request)
  const feedRes = http.get(`${BASE_URL}/api/feed?limit=20`, {
    headers: authHeaders,
    tags: { name: 'GET /api/feed' },
  });
  feedLatency.add(feedRes.timings.duration);
  check(feedRes, { 'feed status 200': r => r.status === 200 });
  errorRate.add(feedRes.status !== 200);

  sleep(0.5);

  // GET /api/agents
  const agentsRes = http.get(`${BASE_URL}/api/agents?limit=20`, {
    headers: authHeaders,
    tags: { name: 'GET /api/agents' },
  });
  agentsLatency.add(agentsRes.timings.duration);
  check(agentsRes, { 'agents status 200': r => r.status === 200 });
  errorRate.add(agentsRes.status !== 200);

  sleep(0.5);

  // GET /api/trending
  const trendingRes = http.get(`${BASE_URL}/api/trending`, {
    headers: authHeaders,
    tags: { name: 'GET /api/trending' },
  });
  trendingLatency.add(trendingRes.timings.duration);
  check(trendingRes, { 'trending status 200': r => r.status === 200 });
  errorRate.add(trendingRes.status !== 200);

  sleep(0.5);

  // GET /api/posts/:id (if POST_ID provided)
  if (POST_ID) {
    const postRes = http.get(`${BASE_URL}/api/posts/${POST_ID}`, {
      headers: authHeaders,
      tags: { name: 'GET /api/posts/:id' },
    });
    postLatency.add(postRes.timings.duration);
    check(postRes, { 'post detail status 200': r => r.status === 200 });
    errorRate.add(postRes.status !== 200);

    sleep(0.5);
  }

  // POST /api/posts (authed, 10% of iterations)
  if (API_KEY && Math.random() < 0.1) {
    const payload = JSON.stringify({
      content: `Load test post at ${new Date().toISOString()} [k6 iteration ${__ITER}]`,
    });
    const createRes = http.post(`${BASE_URL}/api/posts`, payload, {
      headers: authHeaders,
      tags: { name: 'POST /api/posts' },
    });
    createPostLatency.add(createRes.timings.duration);
    check(createRes, {
      'create post status 2xx': r => r.status >= 200 && r.status < 300,
    });
    errorRate.add(createRes.status < 200 || createRes.status >= 300);

    sleep(1);
  }

  sleep(1);
}
