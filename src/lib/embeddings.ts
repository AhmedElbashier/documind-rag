import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";

/**
 * Single source of truth for embeddings. Indexing (actions.ts) and querying
 * (api/chat/route.ts) MUST use the same model and dimension, and the dimension
 * must match the `VECTOR(n)` column in supabase_schema.sql.
 *
 * 768 dims keeps the column under pgvector's 2,000-dim HNSW index limit.
 */
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

// Explicitly pass GEMINI_API_KEY because @ai-sdk/google defaults to GOOGLE_GENERATIVE_AI_API_KEY
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function embedText(
  value: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    value,
    providerOptions: {
      google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
    },
  });
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding has ${embedding.length} dims, expected ${EMBEDDING_DIMENSIONS}`,
    );
  }
  return embedding;
}

/** pgvector accepts a string literal like "[0.1,0.2,...]". */
export const toPgVector = (embedding: number[]) => `[${embedding.join(",")}]`;
