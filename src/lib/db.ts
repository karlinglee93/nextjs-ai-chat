import { db } from "@vercel/postgres";
import { User } from "@/lib/definition";

export async function getUser(email: string): Promise<User | undefined> {
  try {
    const client = await db.connect();
    const users = await client.sql<User>`
      SELECT * FROM users WHERE email=${email};
    `;

    client.release();

    return users.rows[0];
  } catch (error) {
    console.error("❌ Failed to fetch user:", error);
    throw new Error("Failed to fetch user.");
  }
}
