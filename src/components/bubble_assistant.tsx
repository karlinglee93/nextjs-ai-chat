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
import { useMemo, useState } from "react";
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
  /** Try to parse JSON into AssistantData (memoized so chart props are stable across re-renders) */
  const parsed = useMemo<AssistantData | null>(() => {
    try {
      const tmp = JSON.parse(content);
      if (
        tmp &&
        typeof tmp === "object" &&
        ("interpret" in tmp || "reasoning" in tmp)
      ) {
        return tmp as AssistantData;
      }
    } catch {
      /* not JSON */
    }
    return null;
  }, [content]);

  const chartProps = useMemo(() => {
    if (!parsed?.data || !parsed.formattedData || !parsed.chartType)
      return null;
    switch (parsed.chartType) {
      case "bar":
      case "line":
        return {
          type: parsed.chartType,
          xAxis: [{ data: parsed.formattedData.xAxis[0].data }],
          series: [{ data: parsed.formattedData.series[0].data }],
        };
      case "pie":
        return {
          type: parsed.chartType,
          series: [{ data: parsed.formattedData.data }],
        };
      default:
        return null;
    }
  }, [parsed]);

  const [open, setOpen] = useState(false);

  const renderChart = () => {
    if (!chartProps) return null;
    switch (chartProps.type) {
      case "bar":
        return (
          <BarChart
            xAxis={chartProps.xAxis}
            series={chartProps.series}
            height={300}
          />
        );
      case "line":
        return (
          <LineChart
            xAxis={chartProps.xAxis}
            series={chartProps.series}
            height={300}
          />
        );
      case "pie":
        return (
          <PieChart series={chartProps.series} width={200} height={200} />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Typography
        component="div"
        sx={{ whiteSpace: "pre-line", color: "text.primary" }}
      >
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
              </Stack>
            ) : (
              content
            )}
          </>
        )}
      </Typography>

      {/* Chart rendered outside Typography in a stable-width container to avoid
          MUI X Charts ResizeObserver feedback loops. */}
      {!streaming && chartProps && (
        <Box sx={{ width: "100%", maxWidth: 600, mt: 1 }}>{renderChart()}</Box>
      )}

      {streaming && (
        <CircularProgress
          size={16}
          sx={{ ml: 1, verticalAlign: "middle", mt: 0.5 }}
        />
      )}
    </Box>
  );
}
