import { Box, Paper, Typography } from "@mui/material";
import { appConfig } from "@/lib/config";

export default function AssistantBubble({ text }: { text: string }) {
  return (
    <Box sx={{ width: "100%" }}>
      <Typography
        sx={{
          px: 0,
          py: 1,
          whiteSpace: "pre-line",
          color: "text.primary",
        }}
      >
        <Typography component="span" fontWeight={700}>
          {`${appConfig.assistantName}: `}
        </Typography>
        {text}
      </Typography>
    </Box>
  );
}
