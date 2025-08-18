import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";

const batchSize = 50;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  try {
    while (true) {
      const { data: rows, error: selError } = await supabase
        .from("tiktok_sales")
        .select("id, bio")
        .not("bio", "is", null)
        .is("bio_embedding", null)
        .limit(batchSize);

      if (selError) throw selError;
      if (!rows || rows.length === 0) break;

      for (const row of rows) {
        const { id, bio } = row;

        if (!bio || !bio.trim()) continue;
        console.info("Updating id=", row.id);

        const { embedding } = await embed({
          model: openai.textEmbeddingModel("text-embedding-3-small"),
          value: bio,
        });

        const { error: updError } = await supabase
          .from("tiktok_sales")
          .update({ bio_embedding: embedding })
          .eq("id", id);

        if (updError) {
          console.error("Update failed id=", row.id, updError);
        } else {
          console.log("Update successful id=", row.id);
        }
      }
    }

    console.log(`✅ Seeding complete.`);
  } catch (error) {
    console.log(`Error seeding database: ${error}`);
  }
}

seed();
