export type EvalExampleInputs = { question: string };

export type EvalExampleOutputs = {
  expectedMode: "sql" | "vector" | "other";
  expectedChartType?: "bar" | "line" | "pie";
  referenceSql?: string;
  referenceAnswer?: string;
};

export type EvalExample = {
  inputs: EvalExampleInputs;
  outputs: EvalExampleOutputs;
};

export const evalExamples: EvalExample[] = [
  // --- general ---
  {
    inputs: { question: "what can you do for me?" },
    outputs: {
      expectedMode: "other",
      referenceAnswer:
        "Describe the assistant's capabilities: aggregating TikTok sales data into charts and finding creators by bio similarity.",
    },
  },
  {
    inputs: { question: "what kinds of questions can you solve?" },
    outputs: {
      expectedMode: "other",
      referenceAnswer:
        "Explain the kinds of questions handled — analytics on tiktok_sales (counts, averages, comparisons) and semantic search over creator bios.",
    },
  },

  // --- chart: bar ---
  {
    inputs: {
      question:
        "For each gender, show average follower count and average gift income by bar chart.",
    },
    outputs: {
      expectedMode: "sql",
      expectedChartType: "bar",
      referenceSql:
        "SELECT gender, AVG(follower_count) AS avg_followers, AVG(gift_income) AS avg_gift_income FROM tiktok_sales GROUP BY gender;",
      referenceAnswer:
        "Two bars per gender comparing average follower count and average gift income.",
    },
  },
  {
    inputs: { question: "Break down gift income share by region (top 5 regions)." },
    outputs: {
      expectedMode: "sql",
      expectedChartType: "bar",
      referenceSql:
        "SELECT region, SUM(gift_income) AS total_gift_income FROM tiktok_sales GROUP BY region ORDER BY total_gift_income DESC LIMIT 5;",
      referenceAnswer:
        "Top 5 regions ranked by total gift income, shown as a bar chart.",
    },
  },
  {
    inputs: {
      question:
        "Compare average views per livestream across different regions. (top 5)",
    },
    outputs: {
      expectedMode: "sql",
      expectedChartType: "bar",
      referenceSql:
        "SELECT region, AVG(average_views) AS avg_views FROM tiktok_sales GROUP BY region ORDER BY avg_views DESC LIMIT 5;",
      referenceAnswer:
        "Top 5 regions by average views per livestream as a bar chart.",
    },
  },
  {
    inputs: { question: "Show average views male vs female by bar chart" },
    outputs: {
      expectedMode: "sql",
      expectedChartType: "bar",
      referenceSql:
        "SELECT gender, AVG(average_views) AS avg_views FROM tiktok_sales GROUP BY gender;",
      referenceAnswer:
        "Bar chart comparing average views between male and female creators.",
    },
  },

  // --- chart: line ---
  {
    inputs: {
      question: "How does follower count change with increasing video count?",
    },
    outputs: {
      expectedMode: "sql",
      expectedChartType: "line",
      referenceSql:
        "SELECT video_count, AVG(follower_count) AS avg_followers FROM tiktok_sales GROUP BY video_count ORDER BY video_count ASC;",
      referenceAnswer:
        "Line chart of follower count against video count showing the trend.",
    },
  },
  {
    inputs: {
      question:
        "What is the trend of average views as the number of videos grows?",
    },
    outputs: {
      expectedMode: "sql",
      expectedChartType: "line",
      referenceSql:
        "SELECT video_count, AVG(average_views) AS avg_views FROM tiktok_sales GROUP BY video_count ORDER BY video_count ASC;",
      referenceAnswer:
        "Line chart showing average views as a function of video count.",
    },
  },

  // --- chart: pie ---
  {
    inputs: { question: "Show total sales amount by gender with pie chart." },
    outputs: {
      expectedMode: "sql",
      expectedChartType: "pie",
      referenceSql:
        "SELECT gender, SUM(total_sales_amount) AS total_sales FROM tiktok_sales GROUP BY gender;",
      referenceAnswer:
        "Pie chart of total sales amount split by gender.",
    },
  },
  {
    inputs: {
      question: "Who has the best sale amount with pie chart. (top 5)",
    },
    outputs: {
      expectedMode: "sql",
      expectedChartType: "pie",
      referenceSql:
        "SELECT name, total_sales_amount FROM tiktok_sales ORDER BY total_sales_amount DESC LIMIT 5;",
      referenceAnswer:
        "Pie chart of the top 5 creators by total sales amount.",
    },
  },

  // --- vector ---
  {
    inputs: {
      question:
        "Find accounts whose background is living in Japan but speak Chinese",
    },
    outputs: {
      expectedMode: "vector",
      referenceAnswer:
        "Creators whose bios indicate residence in Japan and Chinese-language content.",
    },
  },
  {
    inputs: {
      question:
        "Find creators who mention “beauty” or “makeup tutorials” in their bios.",
    },
    outputs: {
      expectedMode: "vector",
      referenceAnswer:
        "Creators whose bios mention beauty or makeup tutorial content.",
    },
  },
];
