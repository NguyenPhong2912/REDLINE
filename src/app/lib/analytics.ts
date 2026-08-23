export type AnalyticsRange = "24H" | "7D" | "30D" | "90D" | "ALL";

export interface AnalyticsPoint {
  t: string;
  vol: number;
  fee: number;
}

export interface LatencyPoint {
  t: string;
  v: number;
}

export interface AnalyticsKpi {
  label: string;
  value: string;
  delta: string;
}

export interface AnalyticsSnapshot {
  kpis: AnalyticsKpi[];
  series: AnalyticsPoint[];
  latency: LatencyPoint[];
  latencyLabel: string;
}

export const ANALYTICS_RANGES: AnalyticsRange[] = ["24H", "7D", "30D", "90D", "ALL"];

const snapshots: Record<AnalyticsRange, AnalyticsSnapshot> = {
  "24H": {
    kpis: [
      { label: "Total Revenue", value: "$6,840", delta: "+5.8%" },
      { label: "Total Ops", value: "10,241", delta: "+2.4%" },
      { label: "Avg Win Rate", value: "90.8%", delta: "+0.6%" },
      { label: "Network Fees", value: "0.03 SOL", delta: "-4.1%" },
    ],
    series: [
      { t: "00:00", vol: 720, fee: 0.004 },
      { t: "04:00", vol: 830, fee: 0.005 },
      { t: "08:00", vol: 1_120, fee: 0.006 },
      { t: "12:00", vol: 980, fee: 0.004 },
      { t: "16:00", vol: 1_360, fee: 0.005 },
      { t: "20:00", vol: 1_050, fee: 0.004 },
      { t: "Now", vol: 780, fee: 0.002 },
    ],
    latency: [
      { t: "00:00", v: 164 }, { t: "04:00", v: 151 }, { t: "08:00", v: 196 },
      { t: "12:00", v: 137 }, { t: "16:00", v: 143 }, { t: "20:00", v: 122 }, { t: "Now", v: 125 },
    ],
    latencyLabel: "Average ms · all agents · last 24 hours",
  },
  "7D": {
    kpis: [
      { label: "Total Revenue", value: "$48,291", delta: "+22.4%" },
      { label: "Total Ops", value: "71,983", delta: "+8.1%" },
      { label: "Avg Win Rate", value: "91.4%", delta: "+3.2%" },
      { label: "Network Fees", value: "0.18 SOL", delta: "-11.0%" },
    ],
    series: [
      { t: "Mon", vol: 5_680, fee: 0.021 }, { t: "Tue", vol: 7_312, fee: 0.029 },
      { t: "Wed", vol: 6_124, fee: 0.024 }, { t: "Thu", vol: 8_205, fee: 0.031 },
      { t: "Fri", vol: 7_750, fee: 0.028 }, { t: "Sat", vol: 6_410, fee: 0.022 },
      { t: "Sun", vol: 6_810, fee: 0.025 },
    ],
    latency: [
      { t: "Mon", v: 180 }, { t: "Tue", v: 155 }, { t: "Wed", v: 210 },
      { t: "Thu", v: 130 }, { t: "Fri", v: 142 }, { t: "Sat", v: 118 }, { t: "Sun", v: 125 },
    ],
    latencyLabel: "Average ms · all agents · last 7 days",
  },
  "30D": {
    kpis: [
      { label: "Total Revenue", value: "$198,402", delta: "+18.7%" },
      { label: "Total Ops", value: "301,550", delta: "+12.5%" },
      { label: "Avg Win Rate", value: "91.1%", delta: "+1.8%" },
      { label: "Network Fees", value: "0.74 SOL", delta: "-6.4%" },
    ],
    series: [
      { t: "W1", vol: 39_410, fee: 0.15 }, { t: "W2", vol: 45_802, fee: 0.17 },
      { t: "W3", vol: 51_200, fee: 0.19 }, { t: "W4", vol: 61_990, fee: 0.23 },
    ],
    latency: [
      { t: "W1", v: 172 }, { t: "W2", v: 149 }, { t: "W3", v: 138 }, { t: "W4", v: 126 },
    ],
    latencyLabel: "Average ms · all agents · last 30 days",
  },
  "90D": {
    kpis: [
      { label: "Total Revenue", value: "$573,890", delta: "+31.2%" },
      { label: "Total Ops", value: "888,220", delta: "+25.7%" },
      { label: "Avg Win Rate", value: "90.7%", delta: "+2.1%" },
      { label: "Network Fees", value: "2.21 SOL", delta: "-3.5%" },
    ],
    series: [
      { t: "Jun", vol: 161_200, fee: 0.71 }, { t: "Jul", vol: 187_430, fee: 0.73 },
      { t: "Aug", vol: 225_260, fee: 0.77 },
    ],
    latency: [
      { t: "Jun", v: 183 }, { t: "Jul", v: 151 }, { t: "Aug", v: 128 },
    ],
    latencyLabel: "Average ms · all agents · last 90 days",
  },
  ALL: {
    kpis: [
      { label: "Total Revenue", value: "$1,214,550", delta: "+64.3%" },
      { label: "Total Ops", value: "1,942,031", delta: "+58.9%" },
      { label: "Avg Win Rate", value: "90.2%", delta: "+4.4%" },
      { label: "Network Fees", value: "4.88 SOL", delta: "-1.2%" },
    ],
    series: [
      { t: "Q3 '25", vol: 182_400, fee: 0.92 }, { t: "Q4 '25", vol: 268_250, fee: 1.11 },
      { t: "Q1 '26", vol: 341_700, fee: 1.35 }, { t: "Q2 '26", vol: 422_200, fee: 1.5 },
    ],
    latency: [
      { t: "Q3 '25", v: 224 }, { t: "Q4 '25", v: 191 }, { t: "Q1 '26", v: 158 }, { t: "Q2 '26", v: 131 },
    ],
    latencyLabel: "Average ms · all agents · prototype lifetime",
  },
};

export function getAnalyticsSnapshot(range: AnalyticsRange): AnalyticsSnapshot {
  return snapshots[range];
}
