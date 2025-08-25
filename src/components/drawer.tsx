"use client";

import {
  Drawer,
  Toolbar,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  Chip,
  Box,
  Tooltip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { columns, sampleQs } from "@/lib/config";

const drawerWidth = 320;

export default function ChatSideDrawer() {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: "border-box",
          p: 2,
          bgcolor: "#f7f7f8",
        },
      }}
    >
      {/* Sample questions */}
      <Typography variant="subtitle1" gutterBottom>
        Example questions
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 2 }}>
        {Object.values(sampleQs).map((section) => (
          <Box key={section.label}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {section.label}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {section.questions.map((q) => (
                <Tooltip key={q} title={q} placement="top" arrow>
                  <Chip
                    label={q}
                    clickable
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("send-chat", { detail: q })
                      )
                    }
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Column description */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={600}>
            Available Columns
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ maxHeight: 240, overflowY: "auto", pr: 1 }}>
            <List dense disablePadding>
              {columns.map(([name, desc]) => (
                <ListItem
                  key={name}
                  disableGutters
                  sx={{
                    py: 0.3,
                    display: "flex",
                    gap: 0.5,
                    alignItems: "baseline",
                  }}
                >
                  <Typography
                    variant="caption"
                    component="span"
                    sx={{
                      fontWeight: 600,
                      fontSize: "0.72rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </Typography>
                  <Typography
                    variant="caption"
                    component="span"
                    color="text.secondary"
                    sx={{ ml: 0.5, fontSize: "0.7rem" }}
                  >
                    — {desc}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Drawer>
  );
}
