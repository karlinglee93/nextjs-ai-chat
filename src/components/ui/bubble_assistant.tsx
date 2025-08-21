import {
  Box,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { appConfig } from "@/lib/config";
import { BarChart, LineChart, PieChart } from "@mui/x-charts";
import { useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { AssistantData } from "@/lib/definition";

export default function AssistantBubble({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  /** Try to parse JSON into AssistantData */
  let parsed: AssistantData | null = null;
  try {
    const tmp = JSON.parse(content);
    if (
      tmp &&
      typeof tmp === "object" &&
      ("interpret" in tmp || "reasoning" in tmp)
    )
      parsed = tmp as AssistantData;
  } catch {
    /* not JSON */
  }

  const [open, setOpen] = useState(false);

  const renderChart = (d: AssistantData) => {
    if (!d.data || !d.formattedData || !d.chartType) return null;

    switch (d.chartType) {
      case "bar":
        return (
          <BarChart
            xAxis={[{ data: d.formattedData.xAxis[0].data }]}
            series={[{ data: d.formattedData.series[0].data }]}
            height={300}
          />
        );
      case "line":
        return (
          <LineChart
            xAxis={[{ data: d.formattedData.xAxis[0].data }]}
            series={[{ data: d.formattedData.series[0].data }]}
            height={300}
          />
        );
      case "pie":
        return (
          <PieChart
            series={[{ data: d.formattedData.data }]}
            width={200}
            height={200}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Typography sx={{ whiteSpace: "pre-line", color: "text.primary" }}>
        <Typography component="span" fontWeight={700}>
          {`${appConfig.assistantName}: `}
        </Typography>

        {/* ── Streaming phase ── */}
        {streaming && (
          <>
            {content}
            <span className="animate-pulse">▍</span>
          </>
        )}

        {/* ── Final phase ── */}
        {!streaming && (
          <>
            {/* Toggle row */}
            <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
              <IconButton
                size="small"
                onClick={() => setOpen(!open)}
                sx={{ p: 0.5 }}
              >
                {open ? (
                  // eslint-disable-next-line react/jsx-no-undef
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </IconButton>
              <Typography variant="caption">
                {open ? "Hide thinking" : "Show thinking"}
              </Typography>
            </Stack>

            {/* Collapsible full text */}
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box mt={0.5}>{content}</Box>
            </Collapse>

            {parsed ? (
              <Stack spacing={0.5} mt={0.5}>
                {parsed.reasoning && (
                  <Typography variant="body2">
                    <strong>Reasoning:</strong> {parsed.reasoning}
                  </Typography>
                )}
                {parsed.sql && (
                  <Typography variant="body2">
                    <strong>SQL:</strong> {parsed.sql}
                  </Typography>
                )}
                {parsed.interpret && (
                  <Typography variant="body2">
                    <strong>Interpret:</strong> {parsed.interpret}
                  </Typography>
                )}
                {renderChart(parsed)}
              </Stack>
            ) : (
              content
            )}
          </>
        )}
      </Typography>

      {streaming && (
        <CircularProgress
          size={16}
          sx={{ ml: 1, verticalAlign: "middle", mt: 0.5 }}
        />
      )}
    </Box>
  );
}
