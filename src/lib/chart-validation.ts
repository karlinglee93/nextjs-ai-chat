export type ChartType = "bar" | "line" | "pie";

export type ChartValidationResult =
  | { ok: true; reason: "ok" }
  | { ok: false; reason: string };

export function validateChartShape(
  formattedData: unknown,
  chartType: ChartType | null | undefined
): ChartValidationResult {
  if (!formattedData || !chartType) {
    return { ok: false, reason: "missing formattedData or chartType" };
  }

  const fd = formattedData as {
    xAxis?: unknown;
    series?: unknown;
    data?: unknown;
  };

  const xAxisFilled =
    Array.isArray(fd.xAxis) &&
    fd.xAxis.length > 0 &&
    Array.isArray((fd.xAxis[0] as { data?: unknown })?.data) &&
    ((fd.xAxis[0] as { data: unknown[] }).data).length > 0;
  const seriesFilled =
    Array.isArray(fd.series) &&
    fd.series.length > 0 &&
    Array.isArray((fd.series[0] as { data?: unknown })?.data) &&
    ((fd.series[0] as { data: unknown[] }).data).length > 0;
  const dataFilled = Array.isArray(fd.data) && fd.data.length > 0;

  const xAxisAbsent = fd.xAxis == null;
  const seriesAbsent = fd.series == null;
  const dataAbsent = fd.data == null;

  let pass = false;
  if (chartType === "bar" || chartType === "line") {
    pass = xAxisFilled && seriesFilled && dataAbsent;
  } else if (chartType === "pie") {
    pass = dataFilled && xAxisAbsent && seriesAbsent;
  }

  const describe = (filled: boolean, absent: boolean) =>
    filled ? "filled" : absent ? "absent" : "malformed";

  const reason = `chartType=${chartType} xAxis=${describe(xAxisFilled, xAxisAbsent)} series=${describe(seriesFilled, seriesAbsent)} data=${describe(dataFilled, dataAbsent)}`;

  return pass ? { ok: true, reason: "ok" } : { ok: false, reason };
}
