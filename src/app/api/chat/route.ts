import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { embedText, toPgVector } from '@/lib/embeddings';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Explicitly pass GEMINI_API_KEY because @ai-sdk/google defaults to GOOGLE_GENERATIVE_AI_API_KEY
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });

/** Read text from an AI SDK UI message (`parts`) or a legacy `{ content }` payload. */
function getMessageText(message: UIMessage | { content?: unknown; parts?: unknown } | undefined): string {
  if (!message) return "";
  const parts = (message as UIMessage).parts;
  if (Array.isArray(parts)) {
    return parts
      .filter((p): p is { type: "text"; text: string } => p != null && p.type === "text" && typeof (p as { text?: unknown }).text === "string")
      .map((p) => p.text)
      .join("");
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  return "";
}

export async function POST(req: Request) {
  try {
    const { messages, documentId }: { messages?: UIMessage[]; documentId?: string } = await req.json();

    if (!documentId) {
      return new Response("documentId is required", { status: 400 });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("messages are required", { status: 400 });
    }

    const query = getMessageText(messages[messages.length - 1]);
    if (!query.trim()) {
      return new Response("A text message is required", { status: 400 });
    }

    // 1. Embed the user query with the same model + dimension used at indexing time
    const embedding = await embedText(query, 'RETRIEVAL_QUERY');

    // 2. Similarity search scoped to this document (filtered in SQL, before LIMIT)
    const { data: documentChunks, error: matchError } = await supabaseAdmin
      .rpc('match_embeddings', {
        query_embedding: toPgVector(embedding),
        match_count: 8,
        filter_document_id: documentId,
      });

    if (matchError) {
      console.error("Vector Search Error:", matchError);
      return new Response("Error querying the document.", { status: 500 });
    }

    // 3. Build context string with page citations
    const contextText = (documentChunks || [])
      .map((chunk: { metadata?: { loc?: { pageNumber?: number } }; content?: string }) => {
        const pageNum = chunk.metadata?.loc?.pageNumber || "?";
        return `[Page ${pageNum}]: ${chunk.content}`;
      })
      .join("\n\n");

    const systemPrompt = `You are a highly intelligent semantic document assistant.
You are strictly answering questions about the user's uploaded PDF document.
Here is the retrieved context:

<context>
${contextText || "No relevant context found for this query."}
</context>

Rules:
- Answer ONLY using the context above.
- Always cite page numbers: e.g. "According to the document (Page 4)..."
- If the answer is not in the context, say so clearly.`;

    // 4. Stream a UI message response that useChat / DefaultChatTransport can parse.
    // gemini-2.5-flash is the current stable flash model; gemini-2.0-flash returned empty streams.
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(message, { status: 500 });
  }
}
