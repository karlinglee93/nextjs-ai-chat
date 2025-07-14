export const appConfig = {
  title: "Glu: TikTok Sales Assistant",
  assistantName: "Glu",
  themeColor: "#8A2BE2",
  model: "gpt-4.1-nano",
};

export const sampleQs = [
  // General ones
  "what can you do for me?",
  "what kinds of questions can you solve?",
  // Technical ones
  "Show total sales amount by gender with pie chart.",
  "Break down gift income share by region (top 5 regions).",
  "Compare average views per livestream across different regions. (top 5)",
  "Trend of total danmaku count by video count buckets",
  "For each gender, show average follower count and average gift income.",
  "Average views male vs female",
  "Who has the best sale amount with pie chart. (top 5)",
];

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
  ["danmaku_user_count", "Unique users who sent danmaku"],
  ["danmaku_content", "Content of danmaku messages"],
  ["total_sales_amount", "Total sales amount during livestream (¥)"],
  ["gift_senders_count", "Number of gift senders"],
  ["gift_income", "Total income from gifts (¥)"],
  ["top_donors", "List of top donors"],
  ["product_category", "Category of promoted product"],
];
