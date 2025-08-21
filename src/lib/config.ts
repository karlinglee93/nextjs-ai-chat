export const appConfig = {
  title: "NORA: TikTok Sales Assistant",
  assistantName: "NORA",
  themeColor: "#8A2BE2",
  model: "gpt-4.1-nano",
};

export const sampleQs = {
  general: {
    label: "- general sample",
    questions: [
      "what can you do for me?",
      "what kinds of questions can you solve?",
    ],
  },
  chart: {
    label: "- data analytics & visualisation sample",
    questions: [
      // 1. bar chart
      "For each gender, show average follower count and average gift income by bar chart.",
      "Break down gift income share by region (top 5 regions).",
      "Compare average views per livestream across different regions. (top 5)",
      "Show average views male vs female by bar chart",
      // 2. line charts
      "How does follower count change with increasing video count?",
      "What is the trend of average views as the number of videos grows?",
      // 3. pie chart
      "Show total sales amount by gender with pie chart.",
      "Who has the best sale amount with pie chart. (top 5)",
    ],
  },
  vector: {
    label: "- vector-based semantic search sample",
    questions: [
      "Find accounts whose background is living in Japan but speak Chinese",
      "Find creators who mention “beauty” or “makeup tutorials” in their bios.",
    ],
  },
};

export const columns: [string, string][] = [
  ["douyin_id", "Douyin account ID"],
  ["name", "User's name"],
  ["bio", "Account bio or description"],
  ["region", "User's region"],
  ["gender", '"F" (female) or "M" (male)'],
  ["follower_count", "Number of followers"],
  ["video_count", "Number of uploaded videos"],
  ["duration", "Livestream duration in seconds"],
  ["average_views", "Average concurrent viewers per livestream"],
  ["total_likes", "Total number of likes"],
  ["total_danmaku_count", "Total danmaku (chat comments)"],
  ["danmaku_content", "Content of danmaku messages"],
  ["total_sales_amount", "Total sales amount during livestream (¥)"],
  ["gift_senders_count", "Number of gift senders"],
  ["gift_income", "Total income from gifts (¥)"],
  ["product_category", "Category of promoted product"],
];
