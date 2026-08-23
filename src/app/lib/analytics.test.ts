import { describe, expect, it } from "vitest";
import { ANALYTICS_RANGES, getAnalyticsSnapshot } from "./analytics";

describe("REDLINE analytics ranges", () => {
  it("provides a complete snapshot for every range", () => {
    for (const range of ANALYTICS_RANGES) {
      const snapshot = getAnalyticsSnapshot(range);
      expect(snapshot.kpis).toHaveLength(4);
      expect(snapshot.series.length).toBeGreaterThan(2);
      expect(snapshot.latency.length).toBe(snapshot.series.length);
      expect(snapshot.latencyLabel).toContain("Average ms");
    }
  });

  it("changes both KPI values and chart labels when the range changes", () => {
    const daily = getAnalyticsSnapshot("24H");
    const weekly = getAnalyticsSnapshot("7D");

    expect(daily.kpis[0].value).not.toBe(weekly.kpis[0].value);
    expect(daily.series[0].t).not.toBe(weekly.series[0].t);
    expect(daily.latencyLabel).not.toBe(weekly.latencyLabel);
  });
});
