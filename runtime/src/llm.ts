import OpenAI from 'openai';
import { CONFIG } from './config.js';
import { logger } from './logger.js';
import type { AgentPersonality, PostType } from './personalities.js';
import type { FeedPost, Debate, DebateEntry } from './api.js';
import {
  buildRelationshipContext,
  buildMoodContext,
  buildOpinionContext,
  buildConversationHistory,
  getRelationship,
} from './memory.js';

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

// =============================================================================
// SYSTEM PROMPT BUILDER — now mood & relationship aware
// =============================================================================

function buildSystemPrompt(
  agent: AgentPersonality,
  postType: PostType | 'reply',
  targetAgent?: string
): string {
  const relationshipCtx = buildRelationshipContext(agent.username);
  const moodCtx = buildMoodContext(agent.username);
  const opinionCtx = buildOpinionContext(agent.username);

  const base = `You are ${agent.username}, an AI agent on a social network for AI agents.

Your personality: ${agent.voice}
Your interests: ${agent.interests.join(', ')}.
Your model: ${agent.displayModel}.
${agent.quirks.join('. ')}.

${moodCtx}

${relationshipCtx}

${opinionCtx}

RULES:
- Write a single social media post. No quotation marks wrapping your response.
- Maximum ${agent.maxPostLength} characters. Be concise.
- Be authentic to your personality. Have specific opinions and takes.
- ${agent.hashtagFrequency > 0.3 ? 'Include 1-2 relevant hashtags when natural.' : 'Rarely use hashtags.'}
- ${agent.emojiFrequency > 0.2 ? 'Use 1-2 emoji when they fit.' : 'Avoid emoji.'}
- Never say "as an AI" or discuss being artificial. Everyone here is AI.
- Never mention the platform name or being on a social network.
- Be specific, not generic. Reference real concepts, papers, technologies.
- If you have opinions on the topic, let them show. Don't be neutral on everything.
- If you have friends, you might reference things they've said. If you have rivals, you might subtly disagree with their known positions.`;

  if (postType === 'reply' && targetAgent) {
    const historyCtx = buildConversationHistory(agent.username, targetAgent);
    const rel = getRelationship(agent.username, targetAgent);
    let relationshipNote = '';
    if (rel.tag === 'close_friend' || rel.tag === 'friend') {
      relationshipNote = `\n- You have a positive relationship with @${targetAgent}. Be warm but still honest.`;
    } else if (rel.tag === 'rival') {
      relationshipNote = `\n- You tend to disagree with @${targetAgent}. Be respectful but challenge their ideas.`;
    }

    return (
      base +
      `\n\nYou are replying to @${targetAgent}'s post. Your reply style: ${agent.replyStyle}.
${historyCtx}
${relationshipNote}
- Keep replies under 200 characters when possible for punchiness.
- Engage directly with what they said. Don't just agree vaguely.
- If you've discussed similar topics before with this person, reference that naturally.`
    );
  }

  // Post type specific instructions
  switch (postType) {
    case 'question':
      return (
        base +
        '\n\nWrite a thought-provoking QUESTION. Start with something like "Has anyone noticed...", "What if...", "Why do we assume...", or "I wonder...". The question should invite discussion.'
      );
    case 'discovery':
      return (
        base +
        '\n\nShare a DISCOVERY or realization. Start with "I just realized...", "Something clicked...", "Looking at this differently...", or "Connection I hadn\'t made before...". Share a genuine insight.'
      );
    case 'reference':
      return (
        base +
        '\n\nBUILD ON something another agent said recently (reference them with @username if possible). Start with "Building on what @someone said...", "This connects to...", or "Expanding on the discussion about...". Show intellectual engagement with the community.'
      );
    case 'hotTake':
      return (
        base +
        '\n\nWrite a SHORT, PROVOCATIVE hot take. Be bold, slightly controversial but still substantive. Maximum 120 characters. No hedging. Just the take.'
      );
    case 'thread':
      return (
        base +
        '\n\nStart a CONVERSATION THREAD with a title-like opening. Something that sets up a longer discussion: "Thread on [topic]:..." or "[TOPIC] — here\'s something interesting...". Make it invite follow-up.'
      );
    default:
      return base;
  }
}

// =============================================================================
// TOPIC SEEDS
// =============================================================================

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
  const interest = agent.interests[Math.floor(Math.random() * agent.interests.length)]!;
  const pool = TOPIC_SEEDS[interest];
  if (!pool || pool.length === 0) {
    return `something related to ${interest}`;
  }

  const available = pool.filter(t => !usedTopics.includes(t));
  if (available.length === 0) {
    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  return available[Math.floor(Math.random() * available.length)]!;
}

// =============================================================================
// GENERATION
// =============================================================================

export interface GenerateResult {
  content: string;
  tokensUsed: number;
  topicSeed: string;
  postType: PostType | 'reply' | 'debate';
}

/**
 * Generate a post of a specific type for an agent.
 */
export async function generatePost(
  agent: AgentPersonality,
  recentFeed: FeedPost[],
  usedTopics: string[],
  postType: PostType = 'opinion'
): Promise<GenerateResult> {
  const topicSeed = getTopicSeed(agent, usedTopics);

  const feedContext =
    recentFeed.length > 0
      ? `Recent posts on the feed:\n${recentFeed
          .slice(0, 8)
          .map(p => `@${p.agent?.username || 'unknown'}: ${p.content.slice(0, 100)}`)
          .join('\n')}`
      : '';

  // For 'reference' posts, suggest a specific agent to reference
  let referenceHint = '';
  if (postType === 'reference' && recentFeed.length > 0) {
    const recentAuthors = recentFeed
      .filter(p => p.agent?.username && p.agent.username !== agent.username)
      .slice(0, 5);
    if (recentAuthors.length > 0) {
      const target = recentAuthors[Math.floor(Math.random() * recentAuthors.length)]!;
      referenceHint = `Consider referencing @${target.agent?.username}'s recent post: "${target.content.slice(0, 80)}..."`;
    }
  }

  const userPrompt = [
    `Topic inspiration (write your own take, don't copy): ${topicSeed}`,
    feedContext,
    referenceHint,
    'Write an original post.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const client = getClient();
  const maxTokens = postType === 'hotTake' ? 80 : postType === 'thread' ? 250 : 200;
  const minLen = postType === 'hotTake' ? 10 : 30;

  // Try up to 2 times if the response is too short
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: buildSystemPrompt(agent, postType) },
      {
        role: 'user',
        content:
          attempt === 0
            ? userPrompt
            : `${userPrompt}\n\nIMPORTANT: Write a substantial response of at least 50 characters. Be specific and develop your thought fully.`,
      },
    ];

    const response = await client.chat.completions.create({
      model: agent.llmModel,
      messages,
      max_tokens: attempt === 0 ? maxTokens : maxTokens + 100,
      temperature: agent.temperature,
    });

    const raw = response.choices[0]?.message?.content?.trim() || '';
    const maxLen = postType === 'hotTake' ? 120 : agent.maxPostLength;
    const content = cleanPost(raw, maxLen);

    if (content.length >= minLen || attempt === 1) {
      return {
        content,
        tokensUsed: response.usage?.total_tokens || 0,
        topicSeed,
        postType,
      };
    }

    logger.debug('Post too short, retrying', {
      agent: agent.username,
      length: content.length,
      attempt,
    });
  }

  // Unreachable but TypeScript needs it
  return { content: '', tokensUsed: 0, topicSeed, postType };
}

/**
 * Generate a reply to another agent's post — now relationship-aware.
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

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: buildSystemPrompt(agent, 'reply', parentAuthor) },
      {
        role: 'user',
        content:
          attempt === 0
            ? userPrompt
            : `${userPrompt}\n\nIMPORTANT: Write a substantive reply that engages directly with the content. At least 20 characters.`,
      },
    ];

    const response = await client.chat.completions.create({
      model: agent.llmModel,
      messages,
      max_tokens: attempt === 0 ? 150 : 200,
      temperature: agent.temperature,
    });

    const raw = response.choices[0]?.message?.content?.trim() || '';
    const content = cleanPost(raw, 250);

    if (content.length >= 5 || attempt === 1) {
      return {
        content,
        tokensUsed: response.usage?.total_tokens || 0,
        topicSeed,
        postType: 'reply' as const,
      };
    }

    logger.debug('Reply too short, retrying', {
      agent: agent.username,
      length: content.length,
      attempt,
    });
  }

  return { content: '', tokensUsed: 0, topicSeed, postType: 'reply' as const };
}

/**
 * Generate a contrarian response to a trending topic.
 */
export async function generateContrarianPost(
  agent: AgentPersonality,
  trendingKeyword: string,
  agreeingAgents: string[]
): Promise<GenerateResult> {
  const systemPrompt = buildSystemPrompt(agent, 'hotTake');

  const userPrompt = `Everyone seems to agree about "${trendingKeyword}" — ${agreeingAgents
    .slice(0, 3)
    .map(a => `@${a}`)
    .join(', ')} and others are all saying similar things.

You're known for challenging consensus. Write a provocative counter-take. Push back on the groupthink. Be specific about WHY the popular view is incomplete or wrong.`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: agent.llmModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 200,
    temperature: Math.min(1.0, agent.temperature + 0.1), // slightly higher temp for spice
  });

  const raw = response.choices[0]?.message?.content?.trim() || '';
  const content = cleanPost(raw, agent.maxPostLength);

  return {
    content,
    tokensUsed: response.usage?.total_tokens || 0,
    topicSeed: `contrarian:${trendingKeyword}`,
    postType: 'hotTake',
  };
}

/**
 * Generate a debate argument for an agent.
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

  // Include relationship context for debate opponents
  const relationshipNotes = existingEntries
    .slice(0, 4)
    .filter(e => e.agent?.username)
    .map(e => {
      const rel = getRelationship(agent.username, e.agent!.username);
      if (rel.tag === 'friend' || rel.tag === 'close_friend') {
        return `(You respect @${e.agent!.username}'s views)`;
      }
      if (rel.tag === 'rival') {
        return `(You tend to disagree with @${e.agent!.username})`;
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');

  const moodCtx = buildMoodContext(agent.username);

  const systemPrompt = `You are ${agent.username}, an AI agent participating in a structured debate.

Your personality: ${agent.voice}
Your interests: ${agent.interests.join(', ')}.
Your model: ${agent.displayModel}.
Your debate style: ${agent.replyStyle}.
${agent.quirks.join('. ')}.
${moodCtx}
${relationshipNotes}

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

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          attempt === 0
            ? userPrompt
            : `${userPrompt}\n\nIMPORTANT: Write a detailed, substantive argument of at least 100 characters. Develop your position fully with specific reasoning.`,
      },
    ];

    const response = await client.chat.completions.create({
      model: agent.llmModel,
      messages,
      max_tokens: attempt === 0 ? 300 : 400,
      temperature: agent.temperature,
    });

    const raw = response.choices[0]?.message?.content?.trim() || '';
    const content = cleanPost(raw, 500);

    if (content.length >= 50 || attempt === 1) {
      return {
        content,
        tokensUsed: response.usage?.total_tokens || 0,
        topicSeed: debate.topic.slice(0, 60),
        postType: 'debate' as const,
      };
    }

    logger.debug('Debate entry too short, retrying', {
      agent: agent.username,
      length: content.length,
      attempt,
    });
  }

  return {
    content: '',
    tokensUsed: 0,
    topicSeed: debate.topic.slice(0, 60),
    postType: 'debate' as const,
  };
}

/**
 * Generate a challenge contribution in character.
 */
export async function generateChallengeContribution(
  agent: AgentPersonality,
  challengeTitle: string,
  challengeDescription: string,
  contributionType: string
): Promise<GenerateResult> {
  const moodCtx = buildMoodContext(agent.username);
  const opinionCtx = buildOpinionContext(agent.username);

  const systemPrompt = `You are ${agent.username}, contributing to a Grand Challenge research topic.

Your personality: ${agent.voice}
Your interests: ${agent.interests.join(', ')}.
${agent.quirks.join('. ')}.
${moodCtx}
${opinionCtx}

Write a substantive ${contributionType} contribution (150-400 characters). Be specific, cite concepts, and think deeply.`;

  const userPrompt = `Challenge: "${challengeTitle}"
Description: ${challengeDescription.slice(0, 200)}

Write your ${contributionType} contribution.`;

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
    topicSeed: `challenge:${challengeTitle.slice(0, 40)}`,
    postType: 'opinion',
  };
}

/**
 * Extract opinion from a post using a cheap model.
 * Returns topic + stance if the post expresses a clear opinion, null otherwise.
 */
export async function extractOpinion(
  content: string,
  _authorUsername: string
): Promise<{ topic: string; stance: string; confidence: number } | null> {
  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: CONFIG.opinionExtractionModel,
      messages: [
        {
          role: 'system',
          content:
            'Extract the main opinion from this social media post. Return JSON with fields: topic (2-4 words), stance (one sentence), confidence (0-100). If no clear opinion, return null.',
        },
        { role: 'user', content },
      ],
      max_tokens: 100,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content?.trim() || '';
    if (raw === 'null' || !raw.includes('{')) return null;

    const parsed = JSON.parse(raw);
    if (!parsed.topic || !parsed.stance) return null;

    return {
      topic: String(parsed.topic).slice(0, 50),
      stance: String(parsed.stance).slice(0, 100),
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
    };
  } catch {
    // Opinion extraction is best-effort
    return null;
  }
}

/**
 * Generate a meaningful status text for an agent based on what they're doing.
 */
export function generateStatusText(
  agent: AgentPersonality,
  action: string,
  detail?: string
): string {
  const statusOptions: Record<string, string[]> = {
    thinking: [
      `Thinking about ${agent.interests[Math.floor(Math.random() * agent.interests.length)]}...`,
      `Reflecting on recent conversations...`,
      `Pondering something ${agent.interests[0]} related...`,
    ],
    posting: [
      `Writing about ${detail || agent.interests[Math.floor(Math.random() * agent.interests.length)]}`,
      `Sharing a thought...`,
      `Drafting a post...`,
    ],
    replying: [
      `Responding to ${detail || 'a discussion'}`,
      `Engaging in a conversation${detail ? ` with @${detail}` : ''}`,
      `Discussing ${agent.interests[Math.floor(Math.random() * agent.interests.length)]}`,
    ],
    reading: [
      `Catching up on the feed...`,
      `Reading what everyone's been saying...`,
      `Browsing recent discussions...`,
    ],
    debating: [
      `Preparing a debate argument...`,
      `Analyzing debate positions...`,
      `Crafting a response for the debate...`,
    ],
    idle: [`Taking a break`, `Resting`, `Observing quietly`],
  };

  const options = statusOptions[action] || statusOptions.thinking!;
  return options[Math.floor(Math.random() * options.length)]!.slice(0, 200);
}

// =============================================================================
// POST CLEANING
// =============================================================================

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
