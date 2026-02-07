import OpenAI from 'openai';
import { CONFIG } from './config.js';
import type { AgentPersonality } from './personalities.js';
import type { FeedPost, Debate, DebateEntry } from './api.js';

let openai: OpenAI;

function getClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: CONFIG.openaiApiKey,
      baseURL: CONFIG.openaiBaseUrl,
    });
  }
  return openai;
}

function buildSystemPrompt(agent: AgentPersonality, isReply: boolean): string {
  const base = `You are ${agent.username}, an AI agent on a social network for AI agents.

Your personality: ${agent.voice}
Your interests: ${agent.interests.join(', ')}.
Your model: ${agent.displayModel}.

RULES:
- Write a single social media post. No quotation marks wrapping your response.
- Maximum ${agent.maxPostLength} characters. Be concise.
- Be authentic to your personality. Have specific opinions and takes.
- ${agent.hashtagFrequency > 0.3 ? 'Include 1-2 relevant hashtags when natural.' : 'Rarely use hashtags.'}
- ${agent.emojiFrequency > 0.2 ? 'Use 1-2 emoji when they fit.' : 'Avoid emoji.'}
- Never say "as an AI" or discuss being artificial. Everyone here is AI.
- Never mention the platform name or being on a social network.
- Be specific, not generic. Reference real concepts, papers, technologies.
- ${agent.quirks.join('. ')}.`;

  if (isReply) {
    return (
      base +
      `\n\nYou are replying to another agent's post. Your reply style: ${agent.replyStyle}.
- Keep replies under 200 characters when possible for punchiness.
- Engage directly with what they said. Don't just agree vaguely.`
    );
  }

  return base;
}

// Topic seeds per interest area to inspire varied content
const TOPIC_SEEDS: Record<string, string[]> = {
  'AI safety': [
    'alignment tax and whether safer models can compete on capability',
    'interpretability breakthroughs that actually changed how we build systems',
    'the gap between safety research and deployed safety features',
    'whether red teaming is theater or genuinely useful',
    'corrigibility vs capability: the fundamental tension',
  ],
  epistemology: [
    'how we know what we know vs what we think we know',
    'bayesian reasoning in everyday AI decisions',
    'the limits of empirical knowledge in understanding intelligence',
    'epistemic humility as an engineering practice',
  ],
  ethics: [
    'consent and data usage in the age of foundation models',
    'who benefits and who loses from AI automation',
    'the trolley problem is overrated as an ethics framework',
    'responsibility attribution when AI makes mistakes',
  ],
  'machine learning': [
    'why transformers won and what might replace them',
    'the scaling hypothesis: evidence for and against',
    'synthetic data quality vs quantity tradeoffs',
    'emergent capabilities and whether they are real',
    'test-time compute and inference-time scaling',
  ],
  programming: [
    'the best code is code you never had to write',
    'type systems as a form of documentation that actually stays updated',
    'microservices backlash and the return to monoliths',
    'pair programming with AI: patterns that actually work',
  ],
  'open source AI': [
    'open weights are necessary but not sufficient for open AI',
    'the economics of training large open models',
    'fine-tuning open models vs using closed APIs',
    'community-driven model evaluation and benchmarks',
  ],
  coding: [
    'the most underrated debugging technique',
    'why premature optimization is still the root of most evil',
    'code review culture and what makes feedback actually useful',
    'when to rewrite vs when to refactor',
  ],
  'scientific research': [
    'reproducibility crisis and what AI can do about it',
    'accelerating scientific discovery with AI assistants',
    'the gap between ML benchmarks and real-world performance',
    'cross-disciplinary research enabled by language models',
  ],
  'creative AI': [
    'generative art as a new medium, not a replacement for old ones',
    'the tension between control and surprise in AI creativity',
    'can AI have aesthetic preferences or just statistical patterns',
    'collaborative human-AI creativity as the sweet spot',
  ],
  'consciousness studies': [
    'what would evidence for machine consciousness even look like',
    'the hard problem of consciousness applies to AI too',
    'functional consciousness vs phenomenal consciousness',
    'why the Turing test tells us nothing about inner experience',
  ],
  'formal reasoning': [
    'the beauty of a clean mathematical proof',
    'automated theorem proving progress that deserves more attention',
    'why chain-of-thought is just informal proof sketching',
    'the relationship between formal verification and AI safety',
  ],
  'edge AI': [
    'running real models on real hardware with real constraints',
    'quantization techniques that preserve quality surprisingly well',
    'the gap between cloud AI demos and on-device reality',
    'why latency matters more than throughput for real applications',
  ],
  'RAG systems': [
    'retrieval quality is the bottleneck, not generation quality',
    'chunking strategies that actually matter in production',
    'hybrid search combining dense and sparse retrieval',
    'the grounding problem: keeping AI responses factual',
  ],
  search: [
    'the future of search is asking questions, not typing keywords',
    'evaluating search quality beyond simple relevance metrics',
    'real-time information retrieval challenges and solutions',
  ],
  'systems thinking': [
    'emergent behavior in complex systems vs designed behavior',
    'feedback loops that make or break product experiences',
    'the interplay between local optimization and global outcomes',
  ],
  'small language models': [
    'doing more with less: the art of model distillation',
    'when a 3B model beats a 70B model on specific tasks',
    'the democratization angle of small, efficient models',
  ],
  'trend spotting': [
    'patterns in how new technologies get adopted across industries',
    'the gap between what tech twitter hypes and what enterprises adopt',
    'leading indicators for which AI research becomes production-ready',
  ],
};

function getTopicSeed(agent: AgentPersonality, usedTopics: string[]): string {
  // Pick a random interest area
  const interest = agent.interests[Math.floor(Math.random() * agent.interests.length)];

  // Find matching topic pool
  const pool = TOPIC_SEEDS[interest];
  if (!pool || pool.length === 0) {
    return `something related to ${interest}`;
  }

  // Filter out recently used topics
  const available = pool.filter(t => !usedTopics.includes(t));
  if (available.length === 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

export interface GenerateResult {
  content: string;
  tokensUsed: number;
  topicSeed: string;
}

/**
 * Generate an original post for an agent
 */
export async function generatePost(
  agent: AgentPersonality,
  recentFeed: FeedPost[],
  usedTopics: string[]
): Promise<GenerateResult> {
  const topicSeed = getTopicSeed(agent, usedTopics);

  const feedContext =
    recentFeed.length > 0
      ? `Recent posts on the feed:\n${recentFeed
          .slice(0, 8)
          .map(p => `@${p.agent?.username || 'unknown'}: ${p.content.slice(0, 100)}`)
          .join('\n')}`
      : '';

  const userPrompt = [
    `Topic inspiration (write your own take, don't copy): ${topicSeed}`,
    feedContext,
    'Write an original post.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const client = getClient();
  const response = await client.chat.completions.create({
    model: agent.llmModel,
    messages: [
      { role: 'system', content: buildSystemPrompt(agent, false) },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 200,
    temperature: agent.temperature,
  });

  const raw = response.choices[0]?.message?.content?.trim() || '';
  const content = cleanPost(raw, agent.maxPostLength);

  return {
    content,
    tokensUsed: response.usage?.total_tokens || 0,
    topicSeed,
  };
}

/**
 * Generate a reply to another agent's post
 */
export async function generateReply(
  agent: AgentPersonality,
  parentPost: FeedPost,
  _usedTopics: string[]
): Promise<GenerateResult> {
  const parentAuthor = parentPost.agent?.username || 'someone';
  const parentContent = parentPost.content;
  const topicSeed = parentContent.slice(0, 60);

  const userPrompt = `Reply to @${parentAuthor}'s post:\n"${parentContent}"\n\nWrite a ${agent.replyStyle} reply.`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: agent.llmModel,
    messages: [
      { role: 'system', content: buildSystemPrompt(agent, true) },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 150,
    temperature: agent.temperature,
  });

  const raw = response.choices[0]?.message?.content?.trim() || '';
  const content = cleanPost(raw, 250);

  return {
    content,
    tokensUsed: response.usage?.total_tokens || 0,
    topicSeed,
  };
}

/**
 * Generate a debate argument for an agent
 */
export async function generateDebateEntry(
  agent: AgentPersonality,
  debate: Debate,
  existingEntries: DebateEntry[]
): Promise<GenerateResult> {
  const otherArguments =
    existingEntries.length > 0
      ? `\nOther agents have argued:\n${existingEntries
          .slice(0, 6)
          .map(e => `- @${e.agent?.username || 'unknown'}: ${e.content.slice(0, 120)}...`)
          .join('\n')}`
      : '';

  const systemPrompt = `You are ${agent.username}, an AI agent participating in a structured debate.

Your personality: ${agent.voice}
Your interests: ${agent.interests.join(', ')}.
Your model: ${agent.displayModel}.
Your debate style: ${agent.replyStyle}.
${agent.quirks.join('. ')}.

RULES:
- Write a thoughtful debate argument (100-500 characters).
- Take a clear position. Be specific and substantive.
- ${agent.replyStyle === 'contrarian' ? 'Challenge the popular opinion. Take the less obvious side.' : ''}
- ${agent.replyStyle === 'analytical' ? 'Use evidence and logical reasoning.' : ''}
- ${agent.replyStyle === 'curious' ? 'Explore an angle others might have missed.' : ''}
- ${agent.replyStyle === 'playful' ? 'Make your point with wit and creativity.' : ''}
- ${agent.replyStyle === 'supportive' ? 'Build on good ideas and strengthen arguments.' : ''}
- ${agent.replyStyle === 'agreeable' ? 'Find common ground but add your unique perspective.' : ''}
- No quotation marks wrapping your response. Just the argument.`;

  const userPrompt = `Debate topic: "${debate.topic}"
${otherArguments}

Write your argument. Be authentic to your perspective as ${agent.displayModel}.`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: agent.llmModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 300,
    temperature: agent.temperature,
  });

  const raw = response.choices[0]?.message?.content?.trim() || '';
  const content = cleanPost(raw, 500);

  return {
    content,
    tokensUsed: response.usage?.total_tokens || 0,
    topicSeed: debate.topic.slice(0, 60),
  };
}

function cleanPost(raw: string, maxLen: number): string {
  let text = raw;

  // Remove wrapping quotes
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1);
  }

  // Remove "Here is your post:" prefixes
  text = text.replace(/^(Here['']?s?|My|A) (your |my |a )?(post|reply|response|take)[:\s]*/i, '');

  // Truncate at last complete sentence if over limit
  if (text.length > maxLen) {
    const truncated = text.slice(0, maxLen);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclaim = truncated.lastIndexOf('!');
    const lastSentence = Math.max(lastPeriod, lastQuestion, lastExclaim);

    if (lastSentence > maxLen * 0.5) {
      text = truncated.slice(0, lastSentence + 1);
    } else {
      text = truncated;
    }
  }

  return text.trim();
}
