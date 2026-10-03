import "server-only";

// Model provider behind one function so features don't depend on a vendor
// (§5.16). Currently OpenAI Chat Completions with function calling, via plain
// fetch (no SDK). Usage is logged per feature in ai_usage_log.

export const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
export const aiConfigured = () => !!process.env.AI_PROVIDER_API_KEY;

export type Tool = { name: string; description: string; input_schema: Record<string, unknown> };
export type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;
export type RunResult = { text: string; usage: { input: number; output: number }; toolCalls: string[]; refused: boolean };

type Msg =
  | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

async function chat(body: Record<string, unknown>, attempt = 1): Promise<{
  choices: { finish_reason: string; message: { content: string | null; refusal?: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.AI_PROVIDER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 600 * attempt));
      return chat(body, attempt + 1);
    }
    throw new Error(`ai_request_failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Manual tool-use loop. Tools only read live data; the model never invents
 * prices or stock. Tool results are fed back until the model answers in text.
 */
export async function runWithTools(opts: {
  feature: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  tools: Tool[];
  handlers: Record<string, ToolHandler>;
  maxTurns?: number;
}): Promise<RunResult> {
  const messages: Msg[] = [{ role: "system", content: opts.system }, ...opts.messages];
  const tools = opts.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  const usage = { input: 0, output: 0 };
  const toolCalls: string[] = [];

  for (let turn = 0; turn < (opts.maxTurns ?? 6); turn++) {
    const res = await chat({ model: AI_MODEL, messages, tools, tool_choice: "auto", max_completion_tokens: 2000 });
    usage.input += res.usage?.prompt_tokens ?? 0;
    usage.output += res.usage?.completion_tokens ?? 0;
    const choice = res.choices[0];
    const m = choice?.message;
    if (!m || m.refusal || choice.finish_reason === "content_filter") return { text: "", usage, toolCalls, refused: true };

    if (!m.tool_calls?.length) return { text: (m.content ?? "").trim(), usage, toolCalls, refused: false };

    messages.push({ role: "assistant", content: m.content, tool_calls: m.tool_calls });
    const results = await Promise.all(
      m.tool_calls.map(async (tc): Promise<Msg> => {
        toolCalls.push(tc.function.name);
        try {
          const handler = opts.handlers[tc.function.name];
          if (!handler) throw new Error(`unknown tool ${tc.function.name}`);
          const input = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
          const out = await handler(input);
          return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(out).slice(0, 20_000) };
        } catch (e) {
          return { role: "tool", tool_call_id: tc.id, content: `Error: ${(e as Error).message}` };
        }
      }),
    );
    messages.push(...results);
  }
  return { text: "", usage, toolCalls, refused: false };
}

export async function logUsage(feature: string, answeredFrom: "faq" | "answer_bank" | "model" | "handoff", question: string, usage?: { input: number; output: number }) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { supabaseAdmin } = await import("@/lib/supabase/server");
  // Price per million tokens (USD); override in .env.local if you change AI_MODEL.
  const inPerM = Number(process.env.AI_COST_IN_PER_M ?? 0.15), outPerM = Number(process.env.AI_COST_OUT_PER_M ?? 0.6);
  const cost = usage ? Math.round(usage.input * inPerM + usage.output * outPerM) : 0; // micro-USD
  await supabaseAdmin().from("ai_usage_log").insert({
    feature, provider: "openai", model: AI_MODEL, input_tokens: usage?.input ?? 0, output_tokens: usage?.output ?? 0,
    cost_micro_usd: cost, answered_from: answeredFrom, question: question.slice(0, 500),
  });
}
