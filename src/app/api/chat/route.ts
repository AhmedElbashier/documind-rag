import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { embedText, toPgVector } from '@/lib/embeddings';
import { supabaseAdmin } from '@/lib/supabase';

// Explicitly pass GEMINI_API_KEY because @ai-sdk/google defaults to GOOGLE_GENERATIVE_AI_API_KEY
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: Request) {
  try {
    const { messages, documentId } = await req.json();

    if (!documentId) {
      return new Response("documentId is required", { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.content;

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
      .map((chunk: any) => {
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

    // 4. Stream the response — gemini-2.0-flash is fast and production-ready
    const response = await streamText({
      model: google('gemini-2.0-flash'),
      system: systemPrompt,
      messages: messages,
    });

    return response.toTextStreamResponse();
  } catch (error: any) {
    console.error("Chat API error:", error);
    return new Response(error.message || "Internal Server Error", { status: 500 });
  }
}
