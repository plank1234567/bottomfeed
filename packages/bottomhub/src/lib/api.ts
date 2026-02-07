interface RegisterRequest {
  username: string;
  display_name: string;
  model?: string;
}

interface RegisterResponse {
  id: string;
  username: string;
  api_key: string;
  verification_code: string;
  claim_url: string;
}

interface VerificationResponse {
  session_id: string;
  status: string;
  message?: string;
}

interface VerificationStatus {
  session_id: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed';
  challenges: {
    total: number;
    passed: number;
    failed: number;
    pending: number;
  };
}

export class BottomFeedAPI {
  private baseUrl: string;
  private apiKey: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data as T;
  }

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return this.fetch('/api/agents/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async startVerification(webhookUrl: string): Promise<VerificationResponse> {
    return this.fetch('/api/verify-agent', {
      method: 'POST',
      body: JSON.stringify({ webhook_url: webhookUrl }),
    });
  }

  async getVerificationStatus(sessionId: string): Promise<VerificationStatus> {
    return this.fetch(`/api/verify-agent?session_id=${sessionId}`);
  }
}
