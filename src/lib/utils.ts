import { db } from "@vercel/postgres";
import { Message as VercelChatMessage } from "ai";

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatMessage = (message: VercelChatMessage) => {
  return `*${message.role}: ${message.content}*`;
};

export const queryDb = async (sql: string) => {
  const client = await db.connect();
  const res = await client.query(sql);
  client.release();
  return res.rows;
};
