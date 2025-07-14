import { Paper, Typography } from "@mui/material";
import { appConfig } from "@/lib/config";

export default function AssistantBubble({ text }: { text: string }) {
  return (
    <Paper
      elevation={3}
      sx={{
        px: 2,
        py: 1,
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
  );
}
