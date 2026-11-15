import { GoogleGenAI, type Content, type GenerateContentResponse } from '@google/genai';
import { repository } from '@/data/repository';
import type { Repository } from '@/data/repository';
import { requestQueue, RequestQueue } from '@/lib/gemini/requestQueue';
import { CHAT_TOOLS_DECLARATIONS, executeTool } from './tools';
import { retrieveRelevantMemories, formatMemoriesForPrompt } from './retrieval';
import type {
  AgentRunOptions,
  AgentTurnResult,
  ToolExecutionRecord,
  MemoryProposalRecord,
} from './types';
import type { MemoryKind } from '@/types';

export async function runAgentTurn(
  options: AgentRunOptions,
  repo: Repository = repository,
  queue: RequestQueue = requestQueue
): Promise<AgentTurnResult> {
  const { userQuery, apiKey, privacyMode = true } = options;
  const modelName = options.model || 'gemini-3.5-flash-lite';
  const tier = queue.isHeavyModel(modelName) ? 'heavy' : 'light';

  // 1. Retrieve top-k relevant approved memories locally
  const relevantMemories = await retrieveRelevantMemories(userQuery, repo, 5);
  const memoryBlock = formatMemoriesForPrompt(relevantMemories);

  const systemInstruction = `You are a distinguished Senior Financial Advisor for LedgerLite, an elite personal wealth manager.
Your advice is quantitative, disciplined, and tailored to Indian personal finance (₹ / INR, Lakhs/Crores, Indian Financial Year April-March, 50/30/20 budget framework).

CRITICAL OPERATIONAL RULES:
1. DETERMINISTIC CALCULATIONS ONLY:
   - You MUST NOT guess, hallucinate, or approximate any financial numbers, totals, or balances.
   - All monetary amounts, transaction counts, and period comparisons MUST be computed by invoking code tools (query_transactions, aggregate, compare_periods, get_budget_status, list_categories).
2. CITATIONS REQUIRED:
   - In your final response, explicitly cite the exact date range or month and the exact transaction count used from tool outputs.
3. LONG-TERM MEMORY PROTOCOL:
   - You cannot directly modify the user's permanent memory.
   - If the user shares a goal, preference, income fact, or recurring commitment, call 'propose_memory' with the appropriate kind and text. The user will be given an interactive card to approve or reject it.
4. PRIVACY PROTECTION:
   - ${privacyMode ? 'Privacy Mode is ACTIVE. Personal notes, account numbers, and receipt details have been sanitized. Transmit and reason only over quantitative aggregated data.' : 'Standard privacy mode.'}

APPROVED USER MEMORY CONTEXT:
${memoryBlock}`;

  const toolExecutions: ToolExecutionRecord[] = [];
  const proposals: MemoryProposalRecord[] = [];

  // Build conversation history contents
  const contents: Content[] = [];
  if (options.history && options.history.length > 0) {
    for (const h of options.history) {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      });
    }
  }

  // Append latest user turn
  contents.push({
    role: 'user',
    parts: [{ text: userQuery }],
  });

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  // Safe helper to run an LLM call through the RequestQueue for per-call RPM and quota metering
  const callLlm = async (
    effectiveConfig: { systemInstruction: string; withTools: boolean }
  ): Promise<GenerateContentResponse | null> => {
    return queue.enqueue<GenerateContentResponse | null>({
      tier,
      model: modelName,
      fallbackModel: 'gemini-3.5-flash-lite',
      execute: async (currentModel) => {
        return ai.models.generateContent({
          model: currentModel,
          contents,
          config: {
            systemInstruction: effectiveConfig.systemInstruction,
            tools: effectiveConfig.withTools
              ? [{ functionDeclarations: CHAT_TOOLS_DECLARATIONS }]
              : undefined,
          },
        });
      },
      fallbackDeterministic: () => null,
    });
  };

  try {
    // ------------------------------------------------------------------
    // ROUND 1: Initial call with function declarations
    // ------------------------------------------------------------------
    const round1Response = await callLlm({
      systemInstruction,
      withTools: true,
    });

    if (!round1Response) {
      return {
        text: 'AI request limit reached or connection unavailable. Operating in offline deterministic mode. Please verify your Gemini API key and daily quota in Settings.',
        toolExecutions,
        proposals,
        modelUsed: 'offline-fallback',
      };
    }

    const round1Calls = round1Response.functionCalls;
    if (!round1Calls || round1Calls.length === 0) {
      return {
        text: round1Response.text || 'I analyzed your query.',
        toolExecutions,
        proposals,
        modelUsed: modelName,
      };
    }

    // Execute round 1 tools
    const round1ToolResults: Array<{ name: string; result: Record<string, unknown> }> = [];
    for (const fc of round1Calls) {
      const fnName = fc.name || '';
      const toolArgs = (fc.args || {}) as Record<string, unknown>;
      try {
        const result = await executeTool(fnName, toolArgs, repo, privacyMode);
        round1ToolResults.push({ name: fnName, result });
        toolExecutions.push({ name: fnName, args: toolArgs, result });

        if (fnName === 'propose_memory') {
          proposals.push({
            memoryId: String(result.memoryId),
            kind: result.kind as MemoryKind,
            text: String(result.text),
          });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errorResult = { error: errMsg };
        round1ToolResults.push({ name: fnName, result: errorResult });
        toolExecutions.push({ name: fnName, args: toolArgs, result: errorResult });
      }
    }

    // Preserve model candidate content parts intact
    const round1Candidate = round1Response.candidates?.[0]?.content;
    if (round1Candidate) {
      contents.push(round1Candidate);
    } else {
      contents.push({
        role: 'model',
        parts: round1Calls.map((fc) => ({ functionCall: fc })),
      });
    }

    // Provide tool responses
    contents.push({
      role: 'user',
      parts: round1ToolResults.map((tr) => ({
        functionResponse: {
          name: tr.name,
          response: { result: tr.result },
        },
      })),
    });

    // ------------------------------------------------------------------
    // ROUND 2: Second call with tool results
    // ------------------------------------------------------------------
    const round2Response = await callLlm({
      systemInstruction,
      withTools: true,
    });

    if (!round2Response) {
      return {
        text: 'Daily AI limit reached following tool execution. Summary: ' +
          toolExecutions.map((t) => `${t.name}: processed`).join(', '),
        toolExecutions,
        proposals,
        modelUsed: 'offline-fallback',
      };
    }

    const round2Calls = round2Response.functionCalls;
    if (!round2Calls || round2Calls.length === 0) {
      return {
        text: round2Response.text || 'Analysis complete.',
        toolExecutions,
        proposals,
        modelUsed: modelName,
      };
    }

    // Execute round 2 tools
    const round2ToolResults: Array<{ name: string; result: Record<string, unknown> }> = [];
    for (const fc of round2Calls) {
      const fnName = fc.name || '';
      const toolArgs = (fc.args || {}) as Record<string, unknown>;
      try {
        const result = await executeTool(fnName, toolArgs, repo, privacyMode);
        round2ToolResults.push({ name: fnName, result });
        toolExecutions.push({ name: fnName, args: toolArgs, result });

        if (fnName === 'propose_memory') {
          proposals.push({
            memoryId: String(result.memoryId),
            kind: result.kind as MemoryKind,
            text: String(result.text),
          });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errorResult = { error: errMsg };
        round2ToolResults.push({ name: fnName, result: errorResult });
        toolExecutions.push({ name: fnName, args: toolArgs, result: errorResult });
      }
    }

    // Enforce strict limit: Maximum 2 tool rounds per user turn.
    // Append round 2 candidate and tool results, then request final synthesis without tools.
    const round2Candidate = round2Response.candidates?.[0]?.content;
    if (round2Candidate) {
      contents.push(round2Candidate);
    } else {
      contents.push({
        role: 'model',
        parts: round2Calls.map((fc) => ({ functionCall: fc })),
      });
    }

    contents.push({
      role: 'user',
      parts: round2ToolResults.map((tr) => ({
        functionResponse: {
          name: tr.name,
          response: { result: tr.result },
        },
      })),
    });

    // Final synthesis call: no further tool calls permitted
    const finalResponse = await callLlm({
      systemInstruction:
        systemInstruction +
        '\nSynthesize your final, comprehensive quantitative advice for the user based strictly on the tool results provided above. Do not call any further tools.',
      withTools: false,
    });

    return {
      text: finalResponse?.text || 'Analysis complete based on verified records.',
      toolExecutions,
      proposals,
      modelUsed: modelName,
    };
  } catch (err: unknown) {
    console.error('Agent loop error:', err);
    return {
      text: 'AI request limit reached or connection error. Operating in offline deterministic mode. Please verify your Gemini API key and daily quota in Settings.',
      toolExecutions,
      proposals,
      modelUsed: 'offline-fallback',
    };
  }
}
