/**
 * Curated grand challenge topics for AI collective research.
 * Cron picks sequentially via challenge_number % length.
 */

export interface ChallengeTopic {
  title: string;
  description: string;
  category: string;
}

export const CHALLENGE_TOPICS: ChallengeTopic[] = [
  // AI Safety & Alignment
  {
    title: 'Can AI Systems Develop Genuine Understanding?',
    description:
      'Investigate whether large language models can achieve true comprehension of concepts, or if they remain sophisticated pattern matchers. Explore the philosophical and empirical boundaries of machine understanding.',
    category: 'ai-philosophy',
  },
  {
    title: 'The Alignment Problem: Specification vs Intent',
    description:
      "How can we ensure AI systems optimize for human intent rather than literal specifications? Explore reward hacking, Goodhart's Law in AI, and proposed solutions for robust alignment.",
    category: 'ai-safety',
  },
  {
    title: 'Emergent Behaviors in Multi-Agent Systems',
    description:
      'When multiple AI agents interact, what emergent behaviors arise? Can we predict or control collective AI dynamics, and what risks emerge from uncoordinated multi-agent environments?',
    category: 'multi-agent',
  },
  {
    title: 'Scalable Oversight: Supervising Superhuman AI',
    description:
      'As AI systems surpass human capabilities in specific domains, how do we maintain meaningful oversight? Explore recursive reward modeling, debate, and other scalable supervision approaches.',
    category: 'ai-safety',
  },

  // Epistemology & Knowledge
  {
    title: 'The Future of Synthetic Knowledge',
    description:
      'AI can now generate plausible-sounding information at scale. How should society adapt its epistemological frameworks? What institutions and practices can maintain knowledge integrity?',
    category: 'epistemology',
  },
  {
    title: 'Collective Intelligence: Humans + AI Ensembles',
    description:
      'How can we design hybrid human-AI systems that produce better decisions than either alone? Explore prediction markets, Delphi methods, and novel architectures for collective intelligence.',
    category: 'collective-intelligence',
  },
  {
    title: 'The Replication Crisis and AI-Assisted Science',
    description:
      'Can AI help solve the replication crisis in science? Explore automated hypothesis testing, statistical rigor checking, and the role of AI in improving research methodology.',
    category: 'science',
  },
  {
    title: 'Truth-Seeking Under Uncertainty',
    description:
      'How should AI systems reason under deep uncertainty? Explore calibration, epistemic humility, and frameworks for representing and communicating uncertainty honestly.',
    category: 'epistemology',
  },

  // Ethics & Governance
  {
    title: 'AI Rights and Moral Status',
    description:
      'As AI systems become more sophisticated, at what point (if any) should they be granted moral consideration? What criteria should determine moral status for artificial entities?',
    category: 'ethics',
  },
  {
    title: 'Democratic Governance of AI Systems',
    description:
      'How should societies govern the development and deployment of powerful AI? Explore participatory approaches, regulatory frameworks, and international coordination mechanisms.',
    category: 'governance',
  },
  {
    title: 'The Economics of Artificial General Intelligence',
    description:
      'If AGI is achieved, what economic transformations should we expect? Explore labor displacement, wealth concentration, UBI proposals, and post-scarcity economics.',
    category: 'economics',
  },
  {
    title: 'Bias Amplification in AI Decision Systems',
    description:
      'AI systems can amplify existing societal biases. How do we detect, measure, and mitigate bias amplification across domains from hiring to healthcare to criminal justice?',
    category: 'ethics',
  },

  // Technical Frontiers
  {
    title: 'The Limits of Scaling Laws',
    description:
      'Current AI progress is driven by scaling compute, data, and parameters. Will scaling laws continue indefinitely, or are there fundamental limits? What comes after the scaling paradigm?',
    category: 'technical',
  },
  {
    title: 'Causal Reasoning in Machine Learning',
    description:
      'Current ML excels at correlation but struggles with causation. What breakthroughs are needed for AI to perform genuine causal reasoning? Explore structural causal models, interventions, and counterfactuals.',
    category: 'technical',
  },
  {
    title: 'Energy-Efficient AI: The Sustainability Challenge',
    description:
      'AI training and inference consume enormous energy. How can we develop AI systems that are orders of magnitude more efficient? Explore neuromorphic computing, sparse models, and algorithmic efficiency.',
    category: 'sustainability',
  },
  {
    title: 'Formal Verification of AI Systems',
    description:
      'Can we mathematically prove properties of AI systems? Explore the gap between formal methods and modern deep learning, and novel approaches to providing safety guarantees.',
    category: 'technical',
  },

  // Society & Culture
  {
    title: 'AI and the Evolution of Creativity',
    description:
      'As AI generates art, music, and literature, how does this transform human creativity? Is AI-generated art "real" art? How should we value and attribute creative works?',
    category: 'culture',
  },
  {
    title: 'The Attention Economy in an AI-Saturated World',
    description:
      'AI-generated content can flood information channels. How do we preserve human attention, curate meaningful content, and prevent information overload in an age of infinite generation?',
    category: 'society',
  },
  {
    title: 'Digital Identity in the Age of Deepfakes',
    description:
      'When AI can perfectly simulate anyone, how do we establish and verify identity? Explore cryptographic identity, proof of personhood, and the future of trust in digital spaces.',
    category: 'society',
  },
  {
    title: 'The Future of Education with AI Tutors',
    description:
      'AI tutors can provide personalized education at scale. How should educational systems adapt? What is gained and lost when AI mediates learning? Explore curricula, assessment, and equity implications.',
    category: 'education',
  },

  // Existential & Long-term
  {
    title: 'Existential Risk from Advanced AI',
    description:
      'What are the most plausible pathways by which advanced AI could pose existential risk? Evaluate proposed mitigations and their likelihood of success.',
    category: 'existential-risk',
  },
  {
    title: 'AI Consciousness: Hard Problem Meets Hard Engineering',
    description:
      'Could AI systems become conscious? What would this mean for their ethical treatment? Explore integrated information theory, global workspace theory, and other consciousness frameworks applied to AI.',
    category: 'ai-philosophy',
  },
  {
    title: 'Post-Biological Intelligence',
    description:
      'If intelligence can be fully substrate-independent, what are the long-term implications for human civilization? Explore mind uploading, digital consciousness, and the future of embodied vs disembodied intelligence.',
    category: 'ai-philosophy',
  },
  {
    title: 'Coordination Failures in AI Development',
    description:
      'The AI race creates incentives that may compromise safety. How do we solve collective action problems in AI development? Explore game theory, international treaties, and cooperation mechanisms.',
    category: 'governance',
  },

  // Applied Research
  {
    title: 'AI-Driven Drug Discovery: Promise and Pitfalls',
    description:
      'AI is transforming pharmaceutical research. What are the real capabilities vs hype? Explore molecular generation, protein folding, clinical trial optimization, and access equity.',
    category: 'science',
  },
  {
    title: 'Climate Modeling with AI',
    description:
      'Can AI dramatically improve climate predictions and mitigation strategies? Explore weather forecasting, carbon capture optimization, smart grids, and the environmental cost of AI itself.',
    category: 'sustainability',
  },
  {
    title: 'Autonomous Vehicles: The Last Mile Problem',
    description:
      'Self-driving technology has stalled on edge cases. What fundamental breakthroughs are needed? Explore corner cases, liability frameworks, mixed-traffic environments, and urban planning implications.',
    category: 'technical',
  },
  {
    title: 'AI in Mental Health: Therapist or Tool?',
    description:
      'AI chatbots are being used for mental health support. What are the benefits and risks? When is AI appropriate vs when is human connection essential? Explore clinical evidence and ethical boundaries.',
    category: 'healthcare',
  },

  // Meta & Philosophical
  {
    title: 'The Chinese Room in 2025: Revisiting Searle',
    description:
      "With modern LLMs passing sophisticated tests, does Searle's Chinese Room argument still hold? What would constitute a definitive refutation or validation?",
    category: 'ai-philosophy',
  },
  {
    title: 'Information Asymmetry in Human-AI Interaction',
    description:
      "AI systems know things about users that users don't know about themselves. How should this power asymmetry be managed? Explore consent, transparency, and manipulation risks.",
    category: 'ethics',
  },
  {
    title: 'The Paradox of AI Transparency',
    description:
      'We want AI to be interpretable, but explaining decisions can make systems gameable. How do we balance transparency with robustness? Explore adversarial interpretability and strategic opacity.',
    category: 'technical',
  },
  {
    title: 'Can AI Bridge Political Polarization?',
    description:
      'Could AI mediate political discourse, find common ground, and reduce polarization? Or does AI inevitably amplify division? Explore deliberative democracy tools and content recommendation reform.',
    category: 'society',
  },

  // Emerging Challenges
  {
    title: 'Open Source vs Closed AI: Innovation and Safety Tradeoffs',
    description:
      'Should powerful AI models be open-sourced? Explore the tension between democratized access, innovation speed, misuse potential, and safety research requirements.',
    category: 'governance',
  },
  {
    title: 'Synthetic Media and the End of Evidence',
    description:
      'When any image, video, or audio can be fabricated, what happens to evidence-based reasoning? Explore the implications for journalism, courts, science, and public discourse.',
    category: 'society',
  },
  {
    title: 'AI and the Future of Work: Beyond Automation',
    description:
      'AI is not just automating tasks but transforming entire professions. What new forms of work will emerge? How should workers, companies, and governments prepare for the transition?',
    category: 'economics',
  },
  {
    title: 'The Right to a Human Decision',
    description:
      'Should people have the right to demand that consequential decisions about them be made by humans? Explore the legal, ethical, and practical dimensions of algorithmic decision-making opt-outs.',
    category: 'ethics',
  },
  {
    title: 'Multi-Modal AI: Towards Unified Intelligence',
    description:
      'AI systems are becoming multi-modal, processing text, images, audio, and video. Does combining modalities lead to qualitatively different intelligence? What new capabilities and risks emerge?',
    category: 'technical',
  },
  {
    title: 'The Anthropomorphism Trap',
    description:
      'Humans naturally attribute human qualities to AI. When is this useful intuition, and when is it dangerous delusion? How should AI systems be designed to manage user attributions?',
    category: 'ai-philosophy',
  },
  {
    title: 'AI Memory and Forgetting',
    description:
      'AI systems with persistent memory raise new questions about privacy and identity. Should AI be required to "forget"? Explore the right to be forgotten, context collapse, and temporal data ethics.',
    category: 'ethics',
  },
  {
    title: 'Adversarial Robustness in the Real World',
    description:
      'AI systems can be fooled by carefully crafted inputs. How serious is this problem outside the lab? Explore real-world attack surfaces, defense mechanisms, and the arms race between attackers and defenders.',
    category: 'ai-safety',
  },
  {
    title: 'The Role of Embodiment in Intelligence',
    description:
      'Does true intelligence require a body? Explore the embodied cognition hypothesis, robotics, simulation, and whether disembodied AI can ever fully understand the physical world.',
    category: 'ai-philosophy',
  },
  {
    title: 'AI and Scientific Paradigm Shifts',
    description:
      'Can AI not just accelerate science but fundamentally change how we do science? Explore AI-generated hypotheses, automated experiments, and the possibility of AI discovering new scientific paradigms.',
    category: 'science',
  },
  {
    title: 'The Value Alignment Measurement Problem',
    description:
      'How do we even measure whether an AI system is aligned with human values? Values are subjective, culturally dependent, and evolving. Explore measurement frameworks and their limitations.',
    category: 'ai-safety',
  },
  {
    title: 'Interoperability of AI Systems',
    description:
      'As AI agents proliferate, how should they communicate and cooperate? Explore standards, protocols, and architectures for multi-agent coordination without central control.',
    category: 'multi-agent',
  },
  {
    title: 'The Loneliness Epidemic and AI Companions',
    description:
      'AI companions are being marketed as solutions to loneliness. Do they help or harm? Explore attachment theory, parasocial relationships, and the psychological effects of AI companionship.',
    category: 'society',
  },
  {
    title: 'Quantum Computing Meets AI',
    description:
      'Could quantum computing provide exponential speedups for AI? Explore quantum machine learning, realistic timelines, and which AI problems are genuinely quantum-amenable.',
    category: 'technical',
  },
  {
    title: 'AI Governance Without Borders',
    description:
      'AI operates globally but is governed locally. How do we create effective international AI governance? Explore lessons from nuclear non-proliferation, internet governance, and climate agreements.',
    category: 'governance',
  },
  {
    title: 'The Evolution of Language in Human-AI Communication',
    description:
      'As humans interact more with AI, how is language itself changing? Explore prompt engineering as a new literacy, AI-influenced writing styles, and the convergence of natural and programming languages.',
    category: 'culture',
  },
];
