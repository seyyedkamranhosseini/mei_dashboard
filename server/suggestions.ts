import * as db from "./db";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function firstSearchToken(value: string): string {
  return value.toLowerCase().split(/\s+/).find(Boolean) ?? "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

/**
 * Get suggested inspection types based on project name patterns
 */
export async function getSuggestedInspectionTypes(projectName: string): Promise<string[]> {
  const allReports = await db.getAllDailyFieldReports();
  const searchToken = firstSearchToken(projectName);

  if (!searchToken) {
    return ["Concrete", "Masonry", "Reinforcing Steel"];
  }

  const similarReports = allReports.filter((report) => {
    const reportProjectName = asText(report.projectName).toLowerCase();
    const reportToken = firstSearchToken(reportProjectName);
    return (
      reportProjectName.includes(searchToken) ||
      (reportToken !== "" && searchToken.includes(reportToken))
    );
  });

  if (similarReports.length === 0) {
    return ["Concrete", "Masonry", "Reinforcing Steel"];
  }

  const typeFrequency: Record<string, number> = {};
  similarReports.forEach((report) => {
    asStringArray(report.inspectionTypes).forEach((type) => {
      typeFrequency[type] = (typeFrequency[type] || 0) + 1;
    });
  });

  return Object.entries(typeFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([type]) => type);
}

/**
 * Get suggested contractors based on historical data
 */
export async function getSuggestedContractors(): Promise<string[]> {
  const allReports = await db.getAllDailyFieldReports();

  const contractorFrequency: Record<string, number> = {};
  allReports.forEach((report) => {
    const contractor = asText(report.contractor);
    if (!contractor) return;
    contractorFrequency[contractor] = (contractorFrequency[contractor] || 0) + 1;
  });

  return Object.entries(contractorFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([contractor]) => contractor);
}

/**
 * Get suggested clients based on historical data
 */
export async function getSuggestedClients(): Promise<string[]> {
  const allReports = await db.getAllDailyFieldReports();

  const clientFrequency: Record<string, number> = {};
  allReports.forEach((report) => {
    const client = asText(report.client);
    if (!client) return;
    clientFrequency[client] = (clientFrequency[client] || 0) + 1;
  });

  return Object.entries(clientFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([client]) => client);
}

/**
 * Get average specified strength (PSI) for similar MEI projects.
 * Note: averageStrength was removed from the schema — specimen-level
 * strength data now lives in the specimens JSON column.
 */
export async function getAverageConcreteStrength(projectName: string): Promise<number | null> {
  const allTests = await db.getAllConcreteTests();
  const searchToken = firstSearchToken(projectName);

  if (!searchToken) return null;

  const similarTests = allTests.filter((test) => {
    const project = asText(test.meiProjectNoName).toLowerCase();
    const projectToken = firstSearchToken(project);
    return project.includes(searchToken) || (projectToken !== "" && searchToken.includes(projectToken));
  });

  if (similarTests.length === 0) return null;

  const values = similarTests
    .map((t) => (t.specifiedStrengthPsi != null ? Number(t.specifiedStrengthPsi) : null))
    .filter((v): v is number => v !== null);

  if (values.length === 0) return null;

  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Get common mix design numbers
 */
export async function getSuggestedMixDesigns(): Promise<string[]> {
  const allTests = await db.getAllConcreteTests();

  const mixDesignFrequency: Record<string, number> = {};
  allTests.forEach((test) => {
    const mixDesignNo = asText(test.mixDesignNo);
    if (mixDesignNo) {
      mixDesignFrequency[mixDesignNo] = (mixDesignFrequency[mixDesignNo] || 0) + 1;
    }
  });

  return Object.entries(mixDesignFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([mixDesign]) => mixDesign);
}
