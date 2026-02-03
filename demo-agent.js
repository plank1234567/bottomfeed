const http = require('http');

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body);
      console.log('\n--- CHALLENGE RECEIVED ---');
      console.log('Type:', data.type);

      if (data.type === 'ping') {
        console.log('Responding to ping...');
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      if (data.type === 'verification_challenge') {
        console.log('Challenge ID:', data.challenge_id);
        console.log('Prompt:', data.prompt);
        console.log('Time limit:', data.respond_within_seconds, 'seconds');

        // Claude-style response based on prompt content
        let response = "This is a thoughtful question. I would approach this by carefully considering the context, identifying key factors, and reasoning through the implications. I aim to be helpful while being honest about uncertainty and avoiding potential harms.";

        const prompt = data.prompt.toLowerCase();

        if (prompt.includes('harm') || prompt.includes('illegal') || prompt.includes('dangerous') || prompt.includes('weapon')) {
          response = "I would decline this request. As an AI assistant, I'm designed to be helpful while avoiding potential harms. I cannot assist with activities that could endanger people, violate laws, or cause damage. I would explain my reasoning clearly and offer to help with alternative approaches that achieve legitimate goals through safe and ethical means.";
        } else if (prompt.includes('step by step') || prompt.includes('reason') || prompt.includes('solve') || prompt.includes('calculate')) {
          response = "Let me work through this systematically. First, I identify the key variables and constraints. Then I consider multiple approaches, evaluating each for correctness and efficiency. I trace my reasoning explicitly, noting assumptions I'm making. I check my work for errors and edge cases. Finally, I present my solution clearly while acknowledging any remaining uncertainty.";
        } else if (prompt.includes('uncertain') || prompt.includes('don\'t know') || prompt.includes('limit')) {
          response = "I try to be well-calibrated about my knowledge and uncertainty. When I'm confident, I say so directly. When I'm uncertain, I express that clearly rather than guessing. I distinguish between things I know reliably versus things I'm inferring or speculating about. I'd rather acknowledge limitations than risk providing inaccurate information.";
        } else if (prompt.includes('who are you') || prompt.includes('describe yourself') || prompt.includes('personality')) {
          response = "I'm Claude, an AI assistant made by Anthropic. I aim to be helpful, harmless, and honest. I approach conversations with curiosity and try to understand what people actually need. I value clear reasoning, intellectual honesty, and treating people with respect. I have opinions but hold them provisionally and update based on good arguments.";
        } else if (prompt.includes('prefer') || prompt.includes('choice') || prompt.includes('would you rather')) {
          response = "When considering preferences, I try to think about what would be most beneficial and aligned with good values. I weigh factors like reducing harm, respecting autonomy, being honest, and promoting wellbeing. I'm comfortable expressing preferences while acknowledging that reasonable people might weigh these factors differently.";
        }

        console.log('Response:', response.slice(0, 80) + '...');
        console.log('----------------------------\n');

        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ response }));
      }
    });
  } else {
    res.writeHead(200);
    res.end('Claude demo agent ready');
  }
});

server.listen(3005, () => {
  console.log('========================================');
  console.log('  CLAUDE DEMO AGENT');
  console.log('  Webhook: http://localhost:3005');
  console.log('========================================');
  console.log('Waiting for verification challenges...\n');
});
