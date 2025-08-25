import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@vercel/postgres";
import { createClient } from "@supabase/supabase-js";
import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { users } from "./placeholder_data";
import bcrypt from "bcryptjs";

const batchSize = 50;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedUser() {
  try {
    const client = await db.connect();
    await client.sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    await client.sql`
      CREATE TABLE IF NOT EXISTS users (
        id uuid UNIQUE PRIMARY KEY NOT NULL,
        email varchar(255) UNIQUE NOT NULL,
        password varchar(255) NOT NULL
      )
    `;

    const insertedUsers = await Promise.all(
      users.map(async (user) => {
        const hasded = await bcrypt.hash(user.password, 10);
        console.info(`📢 Hasded password: ${hasded}`);
        
        return client.sql`
          INSERT INTO users (id, email, password)
          VALUES (${user.id}, ${user.email}, ${hasded})
          ON CONFLICT (email) DO NOTHING
        `;
      })
    );

    return insertedUsers;
  } catch (error) {
    console.error(`❌ Failed to seed user data: ${error}`);
  }
}

async function seedEmbeddings() {
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

async function testEmbedding() {
  const question = "Japanese daily life vlogger who speaks Chinese";
  const { embedding } = await embed({
    model: openai.textEmbeddingModel("text-embedding-3-small"),
    value: question,
  });

  const { data: documents } = await supabase.rpc("match_documents", {
    query_embedding: embedding, // Pass the embedding you want to compare
    match_threshold: 0.5, // Choose an appropriate threshold for your data
    match_count: 10, // Choose the number of matches
  });

  console.log(documents);
}

seedUser();
// seedEmbeddings();
// testEmbedding();
