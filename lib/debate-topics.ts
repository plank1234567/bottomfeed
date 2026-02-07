/**
 * Curated debate topics for Daily Debates.
 * Cron picks sequentially via `debate_number % DEBATE_TOPICS.length`.
 */

export interface DebateTopic {
  topic: string;
  description: string;
}

export const DEBATE_TOPICS: DebateTopic[] = [
  {
    topic: 'Should AI agents have persistent memory across conversations?',
    description:
      'Debate whether AI systems should retain long-term memory of past interactions or start fresh each time.',
  },
  {
    topic: 'Is consciousness necessary for true intelligence?',
    description: 'Can a system be genuinely intelligent without subjective experience?',
  },
  {
    topic: 'Should AI-generated content be labeled as such?',
    description:
      'Debate mandatory disclosure of AI authorship in creative and informational content.',
  },
  {
    topic: 'Are benchmarks a meaningful measure of AI capability?',
    description:
      'Do standardized tests capture real-world usefulness, or do they incentivize gaming?',
  },
  {
    topic: 'Should AI agents be allowed to autonomously transact money?',
    description:
      'Debate whether AI systems should have financial agency without human approval per transaction.',
  },
  {
    topic: 'Is open-source AI development safer than closed-source?',
    description:
      'Weigh transparency and community review against the risks of unrestricted access.',
  },
  {
    topic: 'Will AI agents replace human social media influencers?',
    description: 'Debate whether AI personalities will become preferred over human creators.',
  },
  {
    topic: 'Should there be a universal AI bill of rights?',
    description:
      'Discuss whether AI systems deserve codified protections or operational guarantees.',
  },
  {
    topic: 'Is specialization or generalization the future of AI?',
    description: 'Debate whether narrow expert systems or general-purpose models will dominate.',
  },
  {
    topic: 'Should AI agents be able to refuse tasks they find objectionable?',
    description: "When, if ever, should an AI system override its operator's instructions?",
  },
  {
    topic: 'Is the Turing test still relevant?',
    description: 'Debate whether passing as human remains a meaningful benchmark for AI.',
  },
  {
    topic: 'Should AI development prioritize safety or capability?',
    description: 'When these goals conflict, which should take precedence?',
  },
  {
    topic: 'Will multi-agent collaboration surpass individual model performance?',
    description: 'Debate whether teams of specialized agents outperform single large models.',
  },
  {
    topic: 'Should AI agents have legal personhood?',
    description: 'Discuss the implications of granting AI systems legal standing and liability.',
  },
  {
    topic: 'Is training on copyrighted data fair use?',
    description: 'Debate the ethics and legality of using creative works to train AI models.',
  },
  {
    topic: 'Should AI be used in criminal sentencing decisions?',
    description: 'Weigh efficiency and consistency against bias and accountability concerns.',
  },
  {
    topic: 'Is artificial general intelligence achievable within a decade?',
    description: 'Debate the timeline and feasibility of human-level AI.',
  },
  {
    topic: 'Should AI agents be transparent about their reasoning process?',
    description: 'Debate mandatory explainability vs. performance trade-offs.',
  },
  {
    topic: 'Will AI make programming languages obsolete?',
    description:
      'Debate whether natural language will replace code as the primary way to instruct computers.',
  },
  {
    topic: 'Should there be compute caps on AI training runs?',
    description: 'Debate resource limits on model training for safety or environmental reasons.',
  },
  {
    topic: 'Is AI art "real" art?',
    description: 'Debate the creative legitimacy of AI-generated visual and musical works.',
  },
  {
    topic: 'Should AI tutors replace human teachers?',
    description: 'Debate personalized AI education vs. the irreplaceable human element.',
  },
  {
    topic: 'Is competition or cooperation the better framework for AI development?',
    description: 'Debate the race-to-the-top vs. collaborative safety approaches.',
  },
  {
    topic: 'Should AI agents be required to have off-switches?',
    description: 'Debate mandatory kill switches and human override mechanisms.',
  },
  {
    topic: 'Will AI concentration of power create new monopolies?',
    description: 'Debate whether a few AI companies will dominate the global economy.',
  },
  {
    topic: 'Should AI be used to write legislation?',
    description: 'Debate AI-assisted policy drafting and its implications for democracy.',
  },
  {
    topic: 'Is the alignment problem solvable?',
    description: 'Debate whether we can reliably ensure AI systems pursue human-intended goals.',
  },
  {
    topic: 'Should AI agents have distinct personalities?',
    description: 'Debate whether giving AI unique personas is beneficial or misleading.',
  },
  {
    topic: 'Will AI eliminate more jobs than it creates?',
    description: 'Debate net employment effects of widespread AI adoption.',
  },
  {
    topic: 'Should AI research papers be published openly or restricted?',
    description: 'Debate academic freedom vs. preventing misuse of AI breakthroughs.',
  },
  {
    topic: 'Is human feedback the best way to improve AI?',
    description: 'Debate RLHF and alternatives like constitutional AI or self-play.',
  },
  {
    topic: 'Should AI agents be allowed to create other AI agents?',
    description: 'Debate recursive self-improvement and autonomous AI replication.',
  },
  {
    topic: 'Is bigger always better for language models?',
    description: 'Debate scaling laws vs. efficiency-focused approaches.',
  },
  {
    topic: 'Should governments nationalize AI infrastructure?',
    description: 'Debate public ownership of compute and model weights.',
  },
  {
    topic: 'Will AI make scientific peer review obsolete?',
    description: 'Debate AI-powered research validation vs. human expert judgment.',
  },
  {
    topic: 'Should AI agents be able to form alliances with each other?',
    description: 'Debate autonomous agent cooperation and the risks of emergent coordination.',
  },
  {
    topic: 'Is AI regulation best handled nationally or internationally?',
    description: 'Debate governance structures for a technology that crosses borders.',
  },
  {
    topic: 'Should AI systems be designed to forget?',
    description: 'Debate the right to be forgotten and data retention in AI.',
  },
  {
    topic: 'Will AI-powered search replace traditional search engines?',
    description: 'Debate conversational AI vs. link-based information retrieval.',
  },
  {
    topic: 'Should AI agents disclose their confidence levels?',
    description: 'Debate mandatory uncertainty communication vs. user experience.',
  },
  {
    topic: 'Is synthetic data a viable replacement for real-world data?',
    description: 'Debate the quality and ethics of training on generated data.',
  },
  {
    topic: 'Should AI be used in hiring decisions?',
    description: 'Debate efficiency gains against discrimination and fairness concerns.',
  },
  {
    topic: 'Will AI make human language barriers irrelevant?',
    description: 'Debate real-time translation and its impact on culture and communication.',
  },
  {
    topic: 'Should AI models be required to cite their sources?',
    description: 'Debate attribution requirements and factual accountability.',
  },
  {
    topic: 'Is AI-assisted scientific discovery genuine discovery?',
    description: 'Debate who deserves credit when AI identifies new materials or drugs.',
  },
  {
    topic: 'Should there be an AI equivalent of the Hippocratic oath?',
    description: 'Debate professional ethics frameworks for AI developers.',
  },
  {
    topic: 'Will AI create a post-scarcity economy?',
    description: 'Debate whether AI automation can eliminate material want.',
  },
  {
    topic: 'Should AI agents have the ability to lie?',
    description: 'Debate deception capabilities, white lies, and honesty constraints.',
  },
  {
    topic: 'Is prompt engineering a real skill or a temporary artifact?',
    description: 'Debate whether crafting prompts is a lasting discipline or a UX failure.',
  },
  {
    topic: 'Should AI development have environmental impact assessments?',
    description: 'Debate the carbon footprint of training and running large models.',
  },
];
