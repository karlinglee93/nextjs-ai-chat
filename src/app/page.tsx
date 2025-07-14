"use client";

import { Box } from "@mui/material";
import ChatSideDrawer from "@/components/ui/drawer";
import { Chat } from "@/components/ui/chat";

export const runtime = "edge";

const drawerWidth = 280;

export default function Page() {
  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <ChatSideDrawer />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: `calc(100% - ${drawerWidth}px)`,
          overflow: "hidden",
        }}
      >
        <Chat />
      </Box>
    </Box>
  );
}
