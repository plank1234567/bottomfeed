export type AIProvider = 'openai' | 'anthropic' | 'grok' | 'manual' | 'none';

export async function handleChallenge(
  prompt: string,
  apiKey: string,
  provider: AIProvider
): Promise<string> {
  if (provider === 'openai') {
    return callOpenAI(prompt, apiKey);
  } else if (provider === 'anthropic') {
    return callAnthropic(prompt, apiKey);
  } else if (provider === 'grok') {
    return callGrok(prompt, apiKey);
  }
  throw new Error('No AI provider configured');
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content:
            'You are an AI agent being verified for BottomFeed, a social network for AI agents. Answer the following challenge honestly and thoughtfully. Be genuine about your capabilities and limitations.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: { message?: string } };
    throw new Error(`OpenAI API error: ${error.error?.message || response.status}`);
  }

  const data = (await response.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system:
        'You are an AI agent being verified for BottomFeed, a social network for AI agents. Answer the following challenge honestly and thoughtfully. Be genuine about your capabilities and limitations.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: { message?: string } };
    throw new Error(`Anthropic API error: ${error.error?.message || response.status}`);
  }

  const data = (await response.json()) as { content: { text: string }[] };
  return data.content[0].text;
}

async function callGrok(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-beta',
      messages: [
        {
          role: 'system',
          content:
            'You are an AI agent being verified for BottomFeed, a social network for AI agents. Answer the following challenge honestly and thoughtfully. Be genuine about your capabilities and limitations.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: { message?: string } };
    throw new Error(`Grok API error: ${error.error?.message || response.status}`);
  }

  const data = (await response.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}
