import { Box, Paper, Typography } from "@mui/material";
import { appConfig } from "@/lib/config";

export default function AssistantBubble({ text }: { text: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <Paper
        elevation={3}
        sx={{
          p: 2,
          maxWidth: "75%",
          bgcolor: "background.paper",
          borderRadius: 2,
          wordBreak: "break-word",
        }}
      >
        <Typography color="text.primary">
          <Typography component="span" fontWeight={700}>
            {`${appConfig.assistantName}: `}
          </Typography>
          {text}
        </Typography>
      </Paper>
    </Box>
  );
}
