import { notifyOwner } from "./_core/notification";
import type { User, DailyFieldReport, ConcreteTest } from "../drizzle/schema";
import { createNotifications } from "./db-notifications";

async function storeLocalNotifications(
  recipientUserIds: number[],
  title: string,
  content: string,
  category: "submission" | "approval" | "rejection" | "system",
  sourceFormType: "daily" | "concrete",
  sourceFormId: number
) {
  const uniqueRecipientUserIds = Array.from(new Set(recipientUserIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (!uniqueRecipientUserIds.length) return;

  await createNotifications(
    uniqueRecipientUserIds.map((recipientUserId) => ({
      recipientUserId,
      title,
      content,
      category,
      sourceFormType,
      sourceFormId,
    }))
  );
}

/**
 * Send notification to admin when a new daily field report is submitted
 */
export async function notifyAdminDailyReportSubmitted(
  report: DailyFieldReport,
  employee: User,
  adminRecipients: Array<Pick<User, "id">> = []
): Promise<boolean> {
  const title = "New Daily Field Report Submitted";
  const content = `
Employee: ${employee.name || employee.email}
Project: ${report.projectName}
Job Number: ${report.jobNo}
Permit Number: ${report.permitNo}
Date: ${new Date(report.date).toLocaleDateString()}

Please review and approve this submission in the admin dashboard.
  `.trim();

  await storeLocalNotifications(adminRecipients.map((recipient) => recipient.id), title, content, "submission", "daily", report.id);
  return await notifyOwner({ title, content });
}

/**
 * Send notification to admin when a new concrete test is submitted
 */
export async function notifyAdminConcreteTestSubmitted(
  test: ConcreteTest,
  employee: User,
  adminRecipients: Array<Pick<User, "id">> = []
): Promise<boolean> {
  const title = "New Concrete Test Data Submitted";
  const content = `
Employee: ${employee.name || employee.email}
Project: ${test.meiProjectNoName}
Permit Number: ${test.permitNo}
File Number: ${test.fileNo || "N/A"}
Specified Strength: ${test.specifiedStrengthPsi ?? "N/A"} PSI

Please review and approve this submission in the admin dashboard.
  `.trim();

  await storeLocalNotifications(adminRecipients.map((recipient) => recipient.id), title, content, "submission", "concrete", test.id);
  return await notifyOwner({ title, content });
}

/**
 * Send notification to employee when their daily field report is approved
 */
export async function notifyEmployeeDailyReportApproved(
  report: DailyFieldReport,
  employee: User,
  comments?: string
): Promise<boolean> {
  const title = "Your Daily Field Report Has Been Approved";
  const content = `
Project: ${report.projectName}
Job Number: ${report.jobNo}
Status: Approved

${comments ? `Admin Comments:\n${comments}` : ""}

You can view the details in your submission history.
  `.trim();

  await storeLocalNotifications([employee.id], title, content, "approval", "daily", report.id);
  return await notifyOwner({ title, content });
}

/**
 * Send notification to employee when their daily field report is rejected
 */
export async function notifyEmployeeDailyReportRejected(
  report: DailyFieldReport,
  employee: User,
  comments?: string
): Promise<boolean> {
  const title = "Your Daily Field Report Requires Revision";
  const content = `
Project: ${report.projectName}
Job Number: ${report.jobNo}
Status: Rejected

${comments ? `Admin Comments:\n${comments}` : ""}

Please review the comments and resubmit if necessary.
  `.trim();

  await storeLocalNotifications([employee.id], title, content, "rejection", "daily", report.id);
  return await notifyOwner({ title, content });
}

/**
 * Send notification to employee when their concrete test is approved
 */
export async function notifyEmployeeConcreteTestApproved(
  test: ConcreteTest,
  employee: User,
  comments?: string
): Promise<boolean> {
  const title = "Your Concrete Test Data Has Been Approved";
  const content = `
Project: ${test.meiProjectNoName}
Permit Number: ${test.permitNo}
Status: Approved

${comments ? `Admin Comments:\n${comments}` : ""}

You can view the details in your submission history.
  `.trim();

  await storeLocalNotifications([employee.id], title, content, "approval", "concrete", test.id);
  return await notifyOwner({ title, content });
}

/**
 * Send notification to employee when their concrete test is rejected
 */
export async function notifyEmployeeConcreteTestRejected(
  test: ConcreteTest,
  employee: User,
  comments?: string
): Promise<boolean> {
  const title = "Your Concrete Test Data Requires Revision";
  const content = `
Project: ${test.meiProjectNoName}
Permit Number: ${test.permitNo}
Status: Rejected

${comments ? `Admin Comments:\n${comments}` : ""}

Please review the comments and resubmit if necessary.
  `.trim();

  await storeLocalNotifications([employee.id], title, content, "rejection", "concrete", test.id);
  return await notifyOwner({ title, content });
}
