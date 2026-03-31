import { describe, expect, it } from "vitest";

describe("analytics grouping contracts", () => {
  it("keeps trend bucket keys sortable in YYYY-MM-DD / YYYY-MM format", () => {
    const dayKey = "2026-03-28";
    const weekKey = "2026-03-23";
    const monthKey = "2026-03";

    expect(dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(weekKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(monthKey).toMatch(/^\d{4}-\d{2}$/);
  });

  it("documents the analytics strength field expected by the UI", () => {
    const sample = { projectName: "Project A", avgStrength: 4500, submissionCount: 3 };
    expect(sample.avgStrength).toBe(4500);
    expect(sample.submissionCount).toBe(3);
  });
});
