import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  type Content,
  type GenerateContentResponse,
} from '@google/genai';
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
  ExtractedTransactionProposal,
} from './types';
import type { MemoryKind } from '@/types';

const SYNTHESIS_SUFFIX =
  '\nNow write your answer for the user in plain language, based strictly on the tool results above. ' +
  'Lead with the direct answer and the key numbers in ₹, then up to four short bullet points. Do not call any further tools.';

/** Records why a model turn produced no prose (finish reason + part shapes, no content). */
function logEmptyCandidate(stage: string, res: GenerateContentResponse | null | undefined) {
  const cand = res?.candidates?.[0];
  console.warn(`[assistant] empty ${stage} reply ` + JSON.stringify({
    finishReason: cand?.finishReason,
    partKinds: cand?.content?.parts?.map((p) => Object.keys(p).join('+')),
    blockReason: res?.promptFeedback?.blockReason,
  }));
}

const EMPTY_ANSWER_FALLBACK =
  'I pulled the numbers but couldn’t write them up this time. Open the calculations below to see them, or ask again.';

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
Today's simulated date is 2026-11-15 (Active Month: 2026-11).

CRITICAL OPERATIONAL RULES:
1. DETERMINISTIC CALCULATIONS ONLY:
   - You MUST NOT guess, hallucinate, or approximate any financial numbers, totals, or balances.
   - All monetary amounts, transaction counts, and period comparisons MUST be computed by invoking code tools (query_transactions, aggregate, compare_periods, get_budget_status, list_categories, set_budget).
2. CITATIONS REQUIRED:
   - In your final response, explicitly cite the exact date range or month and the exact transaction count used from tool outputs.
3. BUDGET PERSISTENCE:
   - When the user asks to set, change, configure, or establish a budget (e.g. "set a budget of ₹20,000", "set November budget to 50000", or sets category envelopes), invoke the 'set_budget' tool to persist it immediately into the database. You may also propose a memory fact if appropriate, but you MUST call 'set_budget' so the active budget is saved.
4. LONG-TERM MEMORY PROTOCOL:
   - You cannot directly modify the user's permanent memory.
   - If the user shares a goal, preference, income fact, or recurring commitment, call 'propose_memory' with the appropriate kind and text. The user will be given an interactive card to approve or reject it.
5. PRIVACY PROTECTION:
   - ${privacyMode ? 'Privacy Mode is ACTIVE. Personal notes, account numbers, and receipt details have been sanitized. Transmit and reason only over quantitative aggregated data.' : 'Standard privacy mode.'}

6. MULTIMODAL TRANSACTION EXTRACTION & INGESTION:
   - When the user provides files, bank statements, receipts, invoices, bills, CSV/PDF/text or image screenshots, extract all transaction details with high precision.
   - For every detected transaction or when the user asks to add transactions, invoke 'import_extracted_transactions' with the array of items (date YYYY-MM-DD, amount in INR, merchant, category, paymentMethod, notes).
   - In your final response, summarize what was found and inform the user they can review and add them to their ledger with 1-click.

APPROVED USER MEMORY CONTEXT:
${memoryBlock}`;

  const toolExecutions: ToolExecutionRecord[] = [];
  const proposals: MemoryProposalRecord[] = [];
  const extractedTransactions: ExtractedTransactionProposal[] = [];

  // Build conversation history contents
  const contents: Content[] = [];
  if (options.history && options.history.length > 0) {
    for (const h of options.history) {
      const parts: Content['parts'] = [];
      if (h.attachments && h.attachments.length > 0) {
        for (const att of h.attachments) {
          const cleanBase64 = att.data.replace(/^data:[^;]+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: cleanBase64,
            },
          });
        }
      }
      parts.push({ text: h.text });
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts,
      });
    }
  }

  // Append latest user turn with any attachments
  const userParts: Content['parts'] = [];
  if (options.attachments && options.attachments.length > 0) {
    for (const att of options.attachments) {
      const cleanBase64 = att.data.replace(/^data:[^;]+;base64,/, '');
      userParts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: cleanBase64,
        },
      });
    }
  }
  userParts.push({ text: userQuery });

  contents.push({
    role: 'user',
    parts: userParts,
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
            // Declarations stay present even for the final synthesis: the history
            // contains functionCall/functionResponse parts, and removing the tools
            // makes the model return an empty candidate. Mode NONE forbids new calls.
            tools: [{ functionDeclarations: CHAT_TOOLS_DECLARATIONS }],
            toolConfig: {
              functionCallingConfig: {
                mode: effectiveConfig.withTools ? FunctionCallingConfigMode.AUTO : FunctionCallingConfigMode.NONE,
              },
            },
          },
        });
      },
      fallbackDeterministic: () => null,
    });
  };

  // Some models keep requesting tools during synthesis and return no prose.
  // This writes the answer from a clean, text-only prompt carrying the same
  // verified tool results the model has already seen — no tools available.
  const synthesizeFromResults = async (): Promise<string | undefined> => {
    const digest = toolExecutions
      .map((t) => `### ${t.name}\ninput: ${JSON.stringify(t.args)}\noutput: ${JSON.stringify(t.result).slice(0, 6000)}`)
      .join('\n\n');
    const res = await queue.enqueue<GenerateContentResponse | null>({
      tier,
      model: modelName,
      fallbackModel: 'gemini-3.5-flash-lite',
      execute: async (currentModel) =>
        ai.models.generateContent({
          model: currentModel,
          contents: [
            {
              role: 'user',
              parts: [{ text: `Question: ${userQuery}\n\nVerified results from the user's ledger:\n\n${digest || '(no data returned)'}` }],
            },
          ],
          config: { systemInstruction: systemInstruction + SYNTHESIS_SUFFIX },
        }),
      fallbackDeterministic: () => null,
    });
    if (!res?.text) logEmptyCandidate('clean synthesis', res);
    return res?.text || undefined;
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
        extractedTransactions,
        modelUsed: 'offline-fallback',
      };
    }

    const round1Calls = round1Response.functionCalls;
    if (!round1Calls || round1Calls.length === 0) {
      return {
        text: round1Response.text || EMPTY_ANSWER_FALLBACK,
        toolExecutions,
        proposals,
        extractedTransactions,
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
        if (fnName === 'import_extracted_transactions' || fnName === 'add_transaction') {
          if (Array.isArray(result.transactions)) {
            extractedTransactions.push(...(result.transactions as ExtractedTransactionProposal[]));
          }
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
        extractedTransactions,
        modelUsed: 'offline-fallback',
      };
    }

    const round2Calls = round2Response.functionCalls;
    if (!round2Calls || round2Calls.length === 0) {
      let text = round2Response.text;
      if (!text) {
        logEmptyCandidate('round2', round2Response);
        text = await synthesizeFromResults();
      }
      return {
        text: text || EMPTY_ANSWER_FALLBACK,
        toolExecutions,
        proposals,
        extractedTransactions,
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
        if (fnName === 'import_extracted_transactions' || fnName === 'add_transaction') {
          if (Array.isArray(result.transactions)) {
            extractedTransactions.push(...(result.transactions as ExtractedTransactionProposal[]));
          }
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
    const finalResponse = await callLlm({ systemInstruction: systemInstruction + SYNTHESIS_SUFFIX, withTools: false });

    let finalText = finalResponse?.text;
    if (!finalText) {
      logEmptyCandidate('final', finalResponse);
      finalText = await synthesizeFromResults();
    }

    return {
      text: finalText || EMPTY_ANSWER_FALLBACK,
      toolExecutions,
      proposals,
      extractedTransactions,
      modelUsed: modelName,
    };
  } catch (err: unknown) {
    console.error('Agent loop error:', err);
    return {
      text: 'AI request limit reached or connection error. Operating in offline deterministic mode. Please verify your Gemini API key and daily quota in Settings.',
      toolExecutions,
      proposals,
      extractedTransactions,
      modelUsed: 'offline-fallback',
    };
  }
}
