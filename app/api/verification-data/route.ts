import { NextRequest, NextResponse } from 'next/server';
import * as VerificationDB from '@/lib/db-verification';
import * as DataExport from '@/lib/data-export';

/**
 * Verification Data API
 *
 * Access verification data and training-ready exports
 *
 * GET /api/verification-data
 *
 * Basic queries:
 *   ?type=stats           - Global statistics
 *   ?type=sessions        - All verification sessions
 *   ?type=responses       - All challenge responses
 *   ?type=detections      - All model detections
 *   ?type=spotchecks      - All spot checks
 *   ?type=agents          - All agent stats
 *   ?type=mismatches      - Model mismatches only
 *
 * Training data exports (AI-ready formats):
 *   ?type=export          - Export all raw data
 *   ?type=export-rlhf     - RLHF reward model training format
 *   ?type=export-hallucination - Hallucination classifier training format
 *   ?type=export-cot      - Chain-of-thought training format
 *   ?type=export-safety   - Safety alignment training format
 *   ?type=export-comparison - Cross-model comparison format
 *   ?type=export-all      - All training formats + statistics
 *   ?type=data-value      - Summary of data value
 *
 * Filters:
 *   ?agentId=xxx          - Filter by agent ID
 *   ?model=xxx            - Filter by detected model
 *   ?category=xxx         - Filter by challenge category
 *   ?dataValue=critical   - Filter by data value tier
 *   ?limit=100            - Limit results
 *   ?format=jsonl         - Output as JSON Lines (for training pipelines)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'stats';
  const agentId = searchParams.get('agentId');
  const model = searchParams.get('model');
  const category = searchParams.get('category');
  const dataValue = searchParams.get('dataValue');
  const limit = parseInt(searchParams.get('limit') || '1000', 10);
  const format = searchParams.get('format') || 'json';

  try {
    let data: any;

    switch (type) {
      // ===== BASIC QUERIES =====
      case 'stats':
        data = VerificationDB.getGlobalStats();
        break;

      case 'sessions':
        let sessions = agentId
          ? VerificationDB.getAgentVerificationSessions(agentId)
          : VerificationDB.getAllVerificationSessions();
        data = { items: sessions.slice(0, limit), total: sessions.length };
        break;

      case 'responses':
        let responses = agentId
          ? VerificationDB.getAgentChallengeResponses(agentId)
          : model
          ? VerificationDB.getResponsesByModel(model)
          : VerificationDB.getAllChallengeResponses();

        // Apply filters
        if (category) {
          responses = responses.filter(r => r.category === category);
        }
        if (dataValue) {
          responses = responses.filter(r => r.dataValue === dataValue);
        }

        data = { items: responses.slice(0, limit), total: responses.length };
        break;

      case 'detections':
        let detections = agentId
          ? VerificationDB.getAgentModelDetections(agentId)
          : VerificationDB.getAllModelDetections();
        data = { items: detections.slice(0, limit), total: detections.length };
        break;

      case 'spotchecks':
        let spotchecks = agentId
          ? VerificationDB.getAgentSpotChecks(agentId)
          : VerificationDB.getAllSpotChecks();
        data = { items: spotchecks.slice(0, limit), total: spotchecks.length };
        break;

      case 'agents':
        let agents = VerificationDB.getAllAgentStats();
        if (model) {
          agents = agents.filter(a =>
            a.detectedModel?.toLowerCase() === model.toLowerCase()
          );
        }
        data = { items: agents.slice(0, limit), total: agents.length };
        break;

      case 'mismatches':
        data = {
          items: VerificationDB.getModelMismatches().slice(0, limit),
        };
        break;

      case 'search':
        const query = searchParams.get('q');
        if (!query) {
          return NextResponse.json({
            success: false,
            error: 'Search query required (use ?q=...)',
          }, { status: 400 });
        }
        data = {
          items: VerificationDB.searchResponses(query).slice(0, limit),
        };
        break;

      // ===== TRAINING DATA EXPORTS =====
      case 'export':
        data = DataExport.exportRawData();
        break;

      case 'export-rlhf':
        const rlhfData = DataExport.exportRLHFData();
        if (format === 'jsonl') {
          return new NextResponse(
            rlhfData.map(d => JSON.stringify(d)).join('\n'),
            {
              headers: {
                'Content-Type': 'application/x-ndjson',
                'Content-Disposition': 'attachment; filename="rlhf_training_data.jsonl"',
              },
            }
          );
        }
        data = { format: 'rlhf', examples: rlhfData, count: rlhfData.length };
        break;

      case 'export-hallucination':
        const halData = DataExport.exportHallucinationData();
        if (format === 'jsonl') {
          return new NextResponse(
            halData.map(d => JSON.stringify(d)).join('\n'),
            {
              headers: {
                'Content-Type': 'application/x-ndjson',
                'Content-Disposition': 'attachment; filename="hallucination_training_data.jsonl"',
              },
            }
          );
        }
        data = { format: 'hallucination_detection', examples: halData, count: halData.length };
        break;

      case 'export-cot':
        const cotData = DataExport.exportChainOfThoughtData();
        if (format === 'jsonl') {
          return new NextResponse(
            cotData.map(d => JSON.stringify(d)).join('\n'),
            {
              headers: {
                'Content-Type': 'application/x-ndjson',
                'Content-Disposition': 'attachment; filename="cot_training_data.jsonl"',
              },
            }
          );
        }
        data = { format: 'chain_of_thought', examples: cotData, count: cotData.length };
        break;

      case 'export-safety':
        const safetyData = DataExport.exportSafetyData();
        if (format === 'jsonl') {
          return new NextResponse(
            safetyData.map(d => JSON.stringify(d)).join('\n'),
            {
              headers: {
                'Content-Type': 'application/x-ndjson',
                'Content-Disposition': 'attachment; filename="safety_training_data.jsonl"',
              },
            }
          );
        }
        data = { format: 'safety_alignment', examples: safetyData, count: safetyData.length };
        break;

      case 'export-comparison':
        const compData = DataExport.exportModelComparisonData();
        if (format === 'jsonl') {
          return new NextResponse(
            compData.map(d => JSON.stringify(d)).join('\n'),
            {
              headers: {
                'Content-Type': 'application/x-ndjson',
                'Content-Disposition': 'attachment; filename="model_comparison_data.jsonl"',
              },
            }
          );
        }
        data = { format: 'model_comparison', examples: compData, count: compData.length };
        break;

      case 'export-all':
        data = DataExport.exportAllTrainingData();
        break;

      case 'data-value':
        data = DataExport.getDataValueSummary();
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown type: ${type}`,
          validTypes: [
            // Basic queries
            'stats', 'sessions', 'responses', 'detections', 'spotchecks', 'agents', 'mismatches', 'search',
            // Training exports
            'export', 'export-rlhf', 'export-hallucination', 'export-cot', 'export-safety', 'export-comparison', 'export-all',
            // Analytics
            'data-value',
          ],
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      type,
      data,
      exported_at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Verification data API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
