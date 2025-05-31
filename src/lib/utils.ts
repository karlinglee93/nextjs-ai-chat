import { Message as VercelChatMessage } from "ai";

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatMessage = (message: VercelChatMessage) => {
  return `*${message.role}: ${message.content}*`;
};
