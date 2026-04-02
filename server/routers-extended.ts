import { protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as dbAttach from "./db-attachments";
import { storagePut, storageGet, storageDelete } from "./storage";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

export const attachmentRouter = router({
  // Upload attachment to a form
  uploadAttachment: protectedProcedure
    .input(
      z.object({
        formType: z.enum(["daily", "concrete"]),
        formId: z.number(),
        fileName: z.string(),
        fileData: z.instanceof(Uint8Array),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const parentRecord =
          input.formType === "daily"
            ? await db.getDailyFieldReportById(input.formId)
            : await db.getConcreteTestById(input.formId);

        if (!parentRecord) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Cannot attach file to a missing report",
          });
        }

        // Upload to S3
        // Validate for concrete form: only allow common mobile image types
        if (input.formType === 'concrete') {
          const allowed = new Set([
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif',
            'image/avif',
            'image/gif',
            'image/tiff',
            'image/bmp',
            'image/svg+xml',
          ]);
          const ext = (input.fileName || '').toLowerCase().includes('.') ? (input.fileName || '').toLowerCase().slice((input.fileName || '').lastIndexOf('.')) : '';
          const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.avif', '.gif', '.tif', '.tiff', '.bmp', '.svg']);
          if (!(allowed.has((input.mimeType || '').toLowerCase()) || allowedExt.has(ext))) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unsupported file type for concrete attachments' });
          }
          if (!input.fileData || (input.fileData as Uint8Array).length === 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Empty or corrupted file' });
          }
        }

        const fileKey = `attachments/${ctx.user.id}/${input.formType}/${input.formId}/${Date.now()}-${input.fileName}`;
        const fileBuffer = Buffer.from(input.fileData);
        const { url } = await storagePut(
          fileKey,
          fileBuffer,
          input.mimeType || "application/octet-stream"
        );

        // Store metadata in database
        await dbAttach.createAttachment({
          formType: input.formType,
          formId: input.formId,
          userId: ctx.user.id,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          mimeType: input.mimeType,
          fileSize: input.fileData.length,
        });

        return { success: true, url, fileKey };
      } catch (error: any) {
        console.error("Upload error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload attachment",
        });
      }
    }),

  // Get attachments for a form
  getAttachments: protectedProcedure
    .input(
      z.object({
        formType: z.enum(["daily", "concrete"]),
        formId: z.number(),
      })
    )
    .query(async ({ input }) => {
      return await dbAttach.getAttachmentsByFormId(input.formType, input.formId);
    }),

  // Get attachments with fresh presigned download URLs resolved server-side
  getAttachmentsWithUrls: protectedProcedure
    .input(
      z.object({
        formType: z.enum(["daily", "concrete"]),
        formId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const rows = await dbAttach.getAttachmentsByFormId(input.formType, input.formId);
      const withUrls = await Promise.all(
        rows.map(async (att) => {
          try {
            const { url } = await storageGet(att.fileKey);
            return { ...att, signedUrl: url };
          } catch {
            return { ...att, signedUrl: att.fileUrl };
          }
        })
      );
      return withUrls;
    }),

  // Delete attachment
  deleteAttachment: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      const attachment = await dbAttach.getAttachmentById(input);
      if (!attachment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Attachment not found",
        });
      }

      if (ctx.user.role !== "admin" && attachment.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete another user's attachment",
        });
      }

      console.info("[Attachment] Delete requested", {
        attachmentId: attachment.id,
        formType: attachment.formType,
        formId: attachment.formId,
        fileKey: attachment.fileKey,
        userId: ctx.user.id,
      });

      try {
        const storageResult = await storageDelete(attachment.fileKey);
        if (storageResult.missing) {
          console.warn("[Attachment] File already missing during delete", {
            attachmentId: attachment.id,
            fileKey: attachment.fileKey,
          });
        } else {
          console.info("[Attachment] File deleted from storage", {
            attachmentId: attachment.id,
            fileKey: attachment.fileKey,
          });
        }
      } catch (error: any) {
        console.error("[Attachment] Failed to delete file from storage", {
          attachmentId: attachment.id,
          fileKey: attachment.fileKey,
          message: error?.message || String(error),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete attachment file from storage",
        });
      }

      await dbAttach.deleteAttachment(input);
      console.info("[Attachment] Attachment record deleted", {
        attachmentId: attachment.id,
        formType: attachment.formType,
        formId: attachment.formId,
      });

      return { success: true };
    }),

  // Get presigned download URL
  getDownloadUrl: protectedProcedure
    .input(z.string())
    .query(async ({ input }) => {
      try {
        const { url } = await storageGet(input);
        return { url };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate download URL",
        });
      }
    }),
});

export const templateRouter = router({
  // Create form template (admin only)
  createTemplate: adminProcedure
    .input(
      z.object({
        formType: z.enum(["daily", "concrete"]),
        name: z.string().min(1),
        description: z.string().optional(),
        templateData: z.record(z.string(), z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const template = await dbAttach.createFormTemplate({
        createdBy: ctx.user.id,
        formType: input.formType,
        name: input.name,
        description: input.description,
        templateData: input.templateData,
      });

      if (!template) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create template",
        });
      }

      return template;
    }),

  // Get templates by type
  getTemplatesByType: protectedProcedure
    .input(z.enum(["daily", "concrete"]))
    .query(async ({ input }) => {
      return await dbAttach.getFormTemplatesByType(input);
    }),

  // Get single template
  getTemplate: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      return await dbAttach.getFormTemplateById(input);
    }),

  // Update template (admin only)
  updateTemplate: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        templateData: z.record(z.string(), z.any()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.templateData !== undefined) updateData.templateData = updates.templateData;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      await dbAttach.updateFormTemplate(id, updateData);
      return { success: true };
    }),

  // Delete template (admin only)
  deleteTemplate: adminProcedure
    .input(z.number())
    .mutation(async ({ input }) => {
      await dbAttach.deleteFormTemplate(input);
      return { success: true };
    }),
});

export const analyticsRouter = router({
  getDashboardData: adminProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
      groupBy: z.enum(["day", "week", "month"]).default("day"),
    }))
    .query(async ({ input }) => {
      const filters = {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        status: input.status,
      } as const;

      const [dailyStats, concreteStats, strengthByProject, dailyTrend, concreteTrend, inspectorStats] = await Promise.all([
        dbAttach.getSubmissionStatsFiltered("daily", filters),
        dbAttach.getSubmissionStatsFiltered("concrete", filters),
        dbAttach.getAverageConcreteStrengthByProject(filters),
        dbAttach.getSubmissionsByDate("daily", filters, input.groupBy),
        dbAttach.getSubmissionsByDate("concrete", filters, input.groupBy),
        dbAttach.getInspectorStatsFiltered(filters),
      ]);

      return {
        dailyStats,
        concreteStats,
        strengthByProject,
        dailyTrend,
        concreteTrend,
        inspectorStats,
      };
    }),

  // Get submission statistics
  getSubmissionStats: adminProcedure
    .input(z.enum(["daily", "concrete"]))
    .query(async ({ input }) => {
      return await dbAttach.getSubmissionStats(input as "daily" | "concrete");
    }),

  // Get average concrete strength by project
  getAverageStrengthByProject: adminProcedure.query(async () => {
    return await dbAttach.getAverageConcreteStrengthByProject();
  }),

  // Get submissions over time
  getSubmissionsTrend: adminProcedure
    .input(z.enum(["daily", "concrete"]))
    .query(async ({ input }) => {
      return await dbAttach.getSubmissionsByDate(input as "daily" | "concrete");
    }),

  // Get inspector performance metrics
  getInspectorStats: adminProcedure.query(async () => {
    return await dbAttach.getInspectorStats();
  }),
});
