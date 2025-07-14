import { Paper, Typography } from "@mui/material";

export default function UserBubble({ text }: { text: string }) {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        bgcolor: "background.paper",
        borderRadius: 2,
        maxWidth: "80%",
      }}
    >
      <Typography color="text.primary">{text}</Typography>
    </Paper>
  );
}