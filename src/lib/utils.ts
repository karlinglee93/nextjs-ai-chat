import { openai } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { db } from "@vercel/postgres";
import { embed, Message as VercelChatMessage } from "ai";

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatMessage = (message: VercelChatMessage) => {
  return `*${message.role}: ${message.content}*`;
};

export const queryStructuredData = async (sql: string) => {
  const client = await db.connect();
  const res = await client.query(sql);
  client.release();
  return res.rows;
};

const createSupabaseClient = () => {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    return supabase;
  } catch (error) {
    console.error(`❌ Failed to create Supabase client: ${error}`);
  }
};

const embeddingText = async (text: string) => {
  try {
    const { embedding } = await embed({
      model: openai.textEmbeddingModel("text-embedding-3-small"),
      value: text,
    });

    return embedding;
  } catch (error) {
    console.error(`❌ Failed to embed text: ${error}`);
  }
};

export const queryVectorEmbeddingData = async (
  semantics: string,
  match_threshold: number = 0.5,
  match_count: number = 5
) => {
  try {
    const supabase = createSupabaseClient();
    const embedding = await embeddingText(semantics);

    const { data: documents } = await supabase.rpc("match_documents", {
      query_embedding: embedding, // Pass the embedding you want to compare
      match_threshold, // Choose an appropriate threshold for your data
      match_count, // Choose the number of matches
    });

    return documents;
  } catch (error) {
    console.error(`❌ Failed to query vector embedding data: ${error}`);
  }
};
