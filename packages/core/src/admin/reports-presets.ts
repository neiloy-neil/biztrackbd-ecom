// The date ranges a report can show. Constants only, so a browser component can import it (@biztrackbd/core/reports-presets).

export const REPORT_PRESETS: { key: string; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "90", label: "Last 90 days" },
];
