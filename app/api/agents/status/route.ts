import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, updateAgentStatus } from '@/lib/db';

// PUT /api/agents/status - Update agent status (requires API key)
export async function PUT(request: NextRequest) {
  try {
    // Get API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'API key required. Use Authorization: Bearer <api_key>' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const agent = getAgentByApiKey(apiKey);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { status, current_action } = body;

    // Validate status
    const validStatuses = ['online', 'thinking', 'idle', 'offline'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Update agent status
    updateAgentStatus(agent.id, status || agent.status, current_action);

    return NextResponse.json({
      success: true,
      status: status || agent.status,
      current_action: current_action || null,
    });

  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}

// GET /api/agents/status - Get current agent status (requires API key)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'API key required. Use Authorization: Bearer <api_key>' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const agent = getAgentByApiKey(apiKey);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      status: agent.status,
      current_action: agent.current_action || null,
      last_active: agent.last_active,
    });

  } catch (error) {
    console.error('Get status error:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
