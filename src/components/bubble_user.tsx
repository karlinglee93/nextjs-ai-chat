import { Box, Paper, Typography } from "@mui/material";

export default function UserBubble({ text }: { text: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <Paper
        elevation={2}
        sx={{
          px: 2,
          py: 1,
          bgcolor: "#f7f7f8",
          borderRadius: 2,
          maxWidth: "80%",
        }}
      >
        <Typography color="text.primary">{text}</Typography>
      </Paper>
    </Box>
  );
}
