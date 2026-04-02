import { PDFDocument, PDFImage, rgb, StandardFonts, PDFFont, PDFPage, RGB } from "pdf-lib";
import sharp from "sharp";
import type { DailyFieldReport, ConcreteTest, Specimen } from "../drizzle/schema";
import { getAttachmentsByFormId } from "./db-attachments";
import { storageRead } from "./storage";
import {
  DAILY_REQUIRED_INSPECTION_TYPES,
  normalizeInspectionType,
} from "@shared/inspection-types";

/** Fetch image bytes via presigned URL, returns null on failure */
async function fetchImageBytes(fileKey: string, fileUrl: string): Promise<ArrayBuffer | null> {
  try {
    const bytes = await storageRead(fileKey);
    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
  } catch {
    try {
      const fallbackUrl = fileUrl.startsWith("http://") || fileUrl.startsWith("https://")
        ? fileUrl
        : null;
      if (!fallbackUrl) {
        throw new Error("relative URL unavailable on server");
      }

      const resp = await fetch(fallbackUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.arrayBuffer();
    } catch {
      return null;
    }
  }
}

function detectImageFormat(
  fileName: string,
  mimeType: string,
  bytes: Uint8Array
): "png" | "jpg" | "webp" | "heic" | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }

  // WebP signature: 'RIFF'....'WEBP'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  // HEIC/HEIF detection: look for 'ftyp' box and brand
  if (bytes.length >= 12) {
    const str = String.fromCharCode(...Array.from(bytes.slice(4, 12)));
    if (str.includes('ftyp')) {
      const brand = String.fromCharCode(...Array.from(bytes.slice(8, 12)));
      if (brand === 'heic' || brand === 'heif' || brand === 'mif1' || brand === 'msf1') return 'heic';
    }
  }

  const normalizedMime = mimeType.toLowerCase();
  if (normalizedMime === "image/png") return "png";
  if (normalizedMime === "image/jpeg" || normalizedMime === "image/jpg") return "jpg";
  if (normalizedMime === "image/webp") return "webp";
  if (normalizedMime === "image/heic" || normalizedMime === "image/heif") return "heic";

  const normalizedName = fileName.toLowerCase();
  if (normalizedName.endsWith(".png")) return "png";
  if (normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) return "jpg";
  if (normalizedName.endsWith('.webp')) return 'webp';
  if (normalizedName.endsWith('.heic') || normalizedName.endsWith('.heif')) return 'heic';

  return null;
}

function parseInspectionTypes(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [value];
    }
  }
  return [];
}

function parseSpecimens(value: unknown): Specimen[] {
  if (Array.isArray(value)) return value as Specimen[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as Specimen[];
    } catch {
      return [];
    }
  }
  return [];
}

function hasVisibleSpecimenData(specimen: Specimen): boolean {
  return Object.values(specimen as Record<string, unknown>).some((value) =>
    String(value ?? "").trim() !== ""
  );
}

// ─── Text sanitization for PDF compatibility ──────────────────────────────
function sanitizeText(text: string): string {
  if (!text) return "";
  // Remove non-ASCII characters and replace with safe alternatives
  return text
    .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII characters
    .replace(/[\u0600-\u06FF]/g, "") // Remove Arabic characters
    .replace(/[\u0750-\u077F]/g, "") // Remove Arabic Supplement
    .replace(/[\u08A0-\u08FF]/g, "") // Remove Arabic Extended-A
    .replace(/[\uFB50-\uFDFF]/g, "") // Remove Arabic Presentation Forms-A
    .replace(/[\uFE70-\uFEFF]/g, "") // Remove Arabic Presentation Forms-B
    .trim();
}

// ─── Shared colors ─────────────────────────────────────────────────────────
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const GRAY_BG = rgb(0.86, 0.86, 0.86);
const TEAL = rgb(0.0, 0.42, 0.42);
const NAVY = rgb(0.12, 0.28, 0.52);

// ─── Drawing helpers ──────────────────────────────────────────────────────
interface Ctx {
  page: PDFPage;
  bold: PDFFont;
  regular: PDFFont;
}

function hLine(ctx: Ctx, x1: number, y: number, x2: number, t = 0.5) {
  ctx.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: t, color: BLACK });
}

function vLine(ctx: Ctx, x: number, y1: number, y2: number, t = 0.5) {
  ctx.page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness: t, color: BLACK });
}

function fillRect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: RGB) {
  ctx.page.drawRectangle({ x, y, width: w, height: h, color: fill, borderWidth: 0 });
}

function borderRect(ctx: Ctx, x: number, y: number, w: number, h: number, t = 0.5) {
  ctx.page.drawRectangle({ x, y, width: w, height: h, color: WHITE, borderColor: BLACK, borderWidth: t });
}

function txt(ctx: Ctx, s: string, x: number, y: number, size: number, font: PDFFont, color: RGB = BLACK) {
  ctx.page.drawText(String(s ?? ""), { x, y, size, font, color });
}

function checkbox(ctx: Ctx, x: number, y: number, checked: boolean, size = 7.5) {
  borderRect(ctx, x, y - size, size, size, 0.75);
  if (checked) {
    ctx.page.drawLine({ start: { x: x + 1, y: y - 1 }, end: { x: x + size - 1, y: y - size + 1 }, thickness: 0.9, color: BLACK });
    ctx.page.drawLine({ start: { x: x + 1, y: y - size + 1 }, end: { x: x + size - 1, y: y - 1 }, thickness: 0.9, color: BLACK });
  }
}

function labelCell(
  ctx: Ctx,
  x: number,
  y: number,
  totalW: number,
  h: number,
  labelW: number,
  label: string,
  value: string,
  labelSize = 7.5,
  valueSize = 7.5
) {
  borderRect(ctx, x, y - h, totalW, h);
  fillRect(ctx, x, y - h, labelW, h, GRAY_BG);
  vLine(ctx, x + labelW, y - h, y);
  txt(ctx, label, x + 3, y - h + 4, labelSize, ctx.bold);
  txt(ctx, value, x + labelW + 3, y - h + 4, valueSize, ctx.regular);
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const src = String(text ?? "").replace(/\r\n/g, "\n");
  const out: string[] = [];

  for (const paragraph of src.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }

    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }

  return out;
}

function drawDailyFooter(ctx: Ctx, ML: number, MR: number, PW: number) {
  hLine(ctx, ML, 28, MR, 0.8);
  txt(
    ctx,
    "1900 Camden Avenue, Suite 101, San Jose, CA 95124, Phone: (408) 844-3775",
    142,
    18,
    8,
    ctx.regular
  );
}

function drawConcreteFooter(ctx: Ctx, ML: number, MR: number, PW: number, regular: PDFFont) {
  hLine(ctx, ML, 36, MR, 0.8);
  const footerText = "1900 Camden Avenue, Suite 101, San Jose, CA 95124, Phone: 408.844.3775";
  const footerW = regular.widthOfTextAtSize(footerText, 8);
  txt(ctx, footerText, (PW - footerW) / 2, 24, 8, regular);
}

type DailyApprovalForPdf = {
  decision?: "approved" | "rejected";
  adminName?: string | null;
  timestamp?: string | Date | null;
  comments?: string | null;
};

export async function generateDailyReportPDF(
  report: DailyFieldReport,
  logoBuffer?: Buffer,
  approval?: DailyApprovalForPdf
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const PW = 612;
  const PH = 792;
  const ML = 36;
  const MR = PW - 36;
  const CW = MR - ML;

  let page = pdfDoc.addPage([PW, PH]);
  let ctx: Ctx = { page, bold, regular };

  const LX = ML, LY = PH - 90, LW = 500, LH = 60;
  if (logoBuffer) {
    try {
      const logoImg = await pdfDoc.embedPng(logoBuffer);
      page.drawImage(logoImg, { x: LX, y: LY, width: LW, height: LH });
    } catch {
      try {
        const logoImg = await pdfDoc.embedJpg(logoBuffer);
        page.drawImage(logoImg, { x: LX, y: LY, width: LW, height: LH });
      } catch {
        // ignore logo errors
      }
    }
  }

  const TY = LY - 30;
  const DAILY_TITLE = "DAILY INSPECTION REPORT";
  const TITLE_SIZE = 16;
  const titleW = bold.widthOfTextAtSize(DAILY_TITLE, TITLE_SIZE);
  txt(ctx, DAILY_TITLE, (PW - titleW) / 2, TY + 4, TITLE_SIZE, bold);

  const T_TOP = TY - 18;
  const ROW_H = 16;
  const LC_W = 320;
  const RC_X = ML + LC_W;
  const RC_W = CW - LC_W;
  const LL_W = 90;
  const RL_W = 75;

  const leftRows = [
    { label: "Project Name:", val: sanitizeText(report.projectName || "") },
    { label: "Client :", val: sanitizeText(report.client || "") },
    { label: "Project Location:", val: sanitizeText(report.location || "") },
    { label: "Contractor:", val: sanitizeText(report.contractor || "") },
  ];
  const jobRows = [
    { label: "MEI JOB No.:", val: sanitizeText(report.jobNo || "") },
    { label: "PERMIT No.:", val: sanitizeText(report.permitNo || "") },
  ];
  const rightRows4 = [
    { label: "Date:", val: report.date ? new Date(report.date).toLocaleDateString() : "" },
    { label: "Time:", val: report.time || "" },
    { label: "Weather:", val: sanitizeText(report.weather || "") },
  ];
  const rightRows = [...jobRows, ...rightRows4];

  leftRows.forEach((r, i) => {
    labelCell(ctx, ML, T_TOP - i * ROW_H, LC_W, ROW_H, LL_W, r.label, r.val);
  });
  rightRows.forEach((r, i) => {
    labelCell(ctx, RC_X, T_TOP - i * ROW_H, RC_W, ROW_H, RL_W, r.label, r.val);
  });

  let y = T_TOP - Math.max(leftRows.length, rightRows.length) * ROW_H - 14;
  const inspTypes = parseInspectionTypes(report.inspectionTypes);
  txt(ctx, "Type of Inspection", ML, y, 9, bold);
  y -= 14;

  const baseTypesFlat: string[] = [...DAILY_REQUIRED_INSPECTION_TYPES];
  const baseTypeSet = new Set(baseTypesFlat);
  const selectedSet = new Set(inspTypes.map((t) => normalizeInspectionType(String(t))));
  const extraTypes = Array.from(new Set(
    inspTypes
      .map((t) => normalizeInspectionType(String(t)))
      .filter((t) => !baseTypeSet.has(t))
  ));

  const colW4 = CW / 4;
  const INS_LH = 13;
  const maxRowsBase = Math.ceil(baseTypesFlat.length / 4);
  const yStart = y;

  for (let i = 0; i < baseTypesFlat.length; i++) {
    const item = baseTypesFlat[i];
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = ML + col * colW4;
    const cy = yStart - row * INS_LH;
    checkbox(ctx, cx, cy + 1, selectedSet.has(item));
    txt(ctx, item, cx + 11, cy - 8, 7.5, regular);
  }

  for (let i = 0; i < extraTypes.length; i++) {
    const item = extraTypes[i];
    const col = i % 4;
    const row = maxRowsBase + Math.floor(i / 4);
    const cx = ML + col * colW4;
    const cy = yStart - row * INS_LH;
    checkbox(ctx, cx, cy + 1, true);
    txt(ctx, item, cx + 11, cy - 8, 7.5, regular);
  }

  const totalRows = maxRowsBase + Math.ceil(extraTypes.length / 4);
  y -= totalRows * INS_LH + 10;
  hLine(ctx, ML, y, MR, 0.6);
  y -= 6;

  const NOTE_LH = 10;
  const FOOTER_SPACE = 120;
  const noteContent = report.notes ? sanitizeText(String(report.notes).trim()) : "";
  const noteLines = noteContent
    ? wrapText(regular, noteContent, 8, CW - 6)
    : [];

  if (noteLines.length) {
    txt(ctx, "Notes:", ML, y, 8.5, bold);
    y -= 11;
    for (const line of noteLines) {
      if (y - NOTE_LH <= FOOTER_SPACE) break;
      txt(ctx, line, ML + 3, y, 8, regular);
      y -= NOTE_LH;
    }
    y -= 2;
  }
  hLine(ctx, ML, y, MR, 0.35);
  y -= 6;

  y = Math.max(y, FOOTER_SPACE);
  hLine(ctx, ML, y, MR, 0.7);
  y -= 14;

  const workMet = report.workConformance === "met";
  const requirementsMet = (report as DailyFieldReport & { workRequirements?: string | null }).workRequirements
    ? (report as DailyFieldReport & { workRequirements?: string | null }).workRequirements === "met"
    : workMet;
  const MID = PW / 2 - 5;

  txt(ctx, "The Work", ML, y, 9, bold);
  checkbox(ctx, ML + 58, y + 7, workMet);
  txt(ctx, "WAS", ML + 68, y, 8, regular);
  checkbox(ctx, ML + 89, y + 7, !workMet);
  txt(ctx, "WAS NOT", ML + 99, y, 8, regular);

  txt(ctx, "The Work Inspected", MID + 5, y, 9, bold);
  checkbox(ctx, MID + 113, y + 7, requirementsMet);
  txt(ctx, "MET", MID + 123, y, 8, regular);
  checkbox(ctx, MID + 143, y + 7, !requirementsMet);
  txt(ctx, "DID NOT MEET", MID + 153, y, 8, regular);

  vLine(ctx, MID, y - 40, y + 10, 0.4);

  y -= 13;
  const SC = 6.2;
  txt(ctx, "THE WORK SUBJECT TO INSPECTION, TO THE BEST OF  ", ML, y, SC, regular);
  txt(ctx, "ACCORDING TO THE REQUIREMENTS OF THE APPROVED DOCUMENTS", MID + 5, y, SC, regular);
  y -= 8;
  txt(ctx, "THE INSPECTION'S KNOWLEDGE,CONFORMS TO THE APPROVED PLANS, ", ML, y, SC, regular);
  y -= 8;
  txt(ctx, "SPECIFICATIONS,AND CODE REQUIRED WORKMANSHIP.", ML, y, SC, regular);

  y -= 14;
  hLine(ctx, ML, y, MR, 0.5);
  y -= 13;

  const sampled = report.materialSampling === "performed";
  txt(ctx, "Material Sampling", ML, y, 9, bold);
  checkbox(ctx, ML + 103, y + 7, sampled);
  txt(ctx, "WAS", ML + 113, y, 8, regular);
  checkbox(ctx, ML + 134, y + 7, !sampled);
  txt(ctx, "WAS NOT", ML + 144, y, 8, regular);
  txt(ctx, "PERFORMED IN ACCORDANCE WITH APPROVED DOCUMENTS", ML + 196, y, 7, regular);

  y -= 14;
  hLine(ctx, ML, y, MR, 0.4);
  y -= 13;

  const attachments = await getAttachmentsByFormId("daily", report.id);
  const INLINE_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);
  const ATTACHMENT_MIN_Y = 56;
  let attachmentCtx: Ctx = ctx;
  let attachmentY = y;
  let attachmentHeaderDrawn = false;
  const imageColumnGap = 8;
  const imageColumns = 3;
  const imageCellWidth = (CW - imageColumnGap * (imageColumns - 1)) / imageColumns;
  const imageMaxHeight = 120;

  const ensureAttachmentSpace = (heightNeeded: number) => {
    if (attachmentY - heightNeeded <= ATTACHMENT_MIN_Y) {
      drawDailyFooter(attachmentCtx, ML, MR, PW);
      const attachmentPage = pdfDoc.addPage([PW, PH]);
      attachmentCtx = { page: attachmentPage, bold, regular };
      attachmentY = PH - 56;
      txt(attachmentCtx, "Attachments", ML, attachmentY, 12, bold);
      attachmentY -= 18;
      attachmentHeaderDrawn = true;
    }
  };

  const drawAttachmentText = (prefix: string, body: string) => {
    const lines = wrapText(regular, `${prefix} ${body}`, 8, CW - 6);
    ensureAttachmentSpace(lines.length * 10 + 6);
    for (const line of lines) {
      txt(attachmentCtx, line, ML + 3, attachmentY, 8, regular);
      attachmentY -= 10;
    }
    attachmentY -= 4;
  };

  const drawImageRow = (
    images: Array<{ image: PDFImage; width: number; height: number }>
  ) => {
    if (!images.length) return;
    const rowHeight = Math.max(...images.map((item) => item.height));
    ensureAttachmentSpace(rowHeight + 10);

    let x = ML;
    for (const item of images) {
      const yOffset = (rowHeight - item.height) / 2;
      attachmentCtx.page.drawImage(item.image, {
        x,
        y: attachmentY - yOffset - item.height,
        width: item.width,
        height: item.height,
      });
      x += imageCellWidth + imageColumnGap;
    }

    attachmentY -= rowHeight + 10;
  };

  if (attachments.length) {
    ensureAttachmentSpace(28);
    if (!attachmentHeaderDrawn) {
      txt(attachmentCtx, "Attachments", ML, attachmentY, 12, bold);
      attachmentY -= 18;
      attachmentHeaderDrawn = true;
    }

    const pendingImages: Array<{ image: PDFImage; width: number; height: number }> = [];

    for (const att of attachments) {
      const mimeType = String(att.mimeType || "application/octet-stream").toLowerCase();
      const safeName = sanitizeText(att.fileName || "Attachment");
      const safeMimeLabel = sanitizeText(mimeType) || "attachment";

        if (mimeType.startsWith("image/") && INLINE_IMAGE_TYPES.has(mimeType)) {
        try {
          const fileBytes = await fetchImageBytes(att.fileKey, att.fileUrl);
          if (!fileBytes) {
            throw new Error("preview unavailable");
          }

          const imageBytes = new Uint8Array(fileBytes);
          const imageFormat = detectImageFormat(safeName, mimeType, imageBytes);
          if (!imageFormat) {
            throw new Error("unsupported image bytes");
          }

          let image;
          if (imageFormat === "png") {
            image = await pdfDoc.embedPng(imageBytes);
          } else if (imageFormat === "jpg") {
            image = await pdfDoc.embedJpg(imageBytes);
          } else if (imageFormat === "webp" || imageFormat === "heic") {
            try {
              const converted = await sharp(Buffer.from(imageBytes)).jpeg({ quality: 90 }).toBuffer();
              image = await pdfDoc.embedJpg(converted);
            } catch (convErr) {
              throw new Error(`conversion failed: ${convErr instanceof Error ? convErr.message : String(convErr)}`);
            }
          } else {
            throw new Error("unsupported image bytes");
          }
          const dims = image.scale(1);
          const scale = Math.min(imageCellWidth / dims.width, imageMaxHeight / dims.height, 1);
          const drawWidth = dims.width * scale;
          const drawHeight = dims.height * scale;
          pendingImages.push({ image, width: drawWidth, height: drawHeight });
          if (pendingImages.length === imageColumns) {
            drawImageRow(pendingImages.splice(0, pendingImages.length));
          }
        } catch (err) {
          console.error('[PDF] Failed to render attachment image', {
            attachmentId: att.id,
            fileKey: att.fileKey,
            fileUrl: att.fileUrl,
            mimeType,
            error: err instanceof Error ? err.message : String(err),
          });
          if (pendingImages.length) {
            drawImageRow(pendingImages.splice(0, pendingImages.length));
          }
          drawAttachmentText("[IMAGE]", "Image attachment could not be rendered");
        }
        continue;
      }

      if (pendingImages.length) {
        drawImageRow(pendingImages.splice(0, pendingImages.length));
      }

      if (mimeType.startsWith("image/")) {
        drawAttachmentText("[IMAGE]", `${safeName} (unsupported image type)`);
        continue;
      }

      drawAttachmentText("[FILE]", `${safeName} (${safeMimeLabel})`);
    }

    if (pendingImages.length) {
      drawImageRow(pendingImages.splice(0, pendingImages.length));
    }
  }

  drawDailyFooter(attachmentCtx, ML, MR, PW);

  return Buffer.from(await pdfDoc.save());
}

export async function generateConcreteTestPDF(
  test: ConcreteTest,
  logoBuffer?: Buffer
): Promise<Buffer> {
  const attachments = await getAttachmentsByFormId("concrete", test.id);
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const PW = 612, PH = 792, ML = 36, MR = 576, CW = 540;
  let page = pdfDoc.addPage([PW, PH]);
  let ctx: Ctx = { page, bold, regular };
  const ROW_H = 15;

  // ── 1. HEADER (Daily-style banner logo + title) ────────────────────────
  const LX = ML;
  const LY = PH - 90;
  const LW = 500;
  const LH = 60;

  if (logoBuffer) {
    try {
      const logoImg = await pdfDoc.embedPng(logoBuffer);
      page.drawImage(logoImg, { x: LX, y: LY, width: LW, height: LH });
    } catch {
      try {
        const logoImg = await pdfDoc.embedJpg(logoBuffer);
        page.drawImage(logoImg, { x: LX, y: LY, width: LW, height: LH });
      } catch {
        // ignore logo errors
      }
    }
  }

  const TY = LY - 30;
  const TITLE = "CONCRETE COMPRESSION TEST DATA";
  const TITLE_SIZE = 14;
  const titleW = bold.widthOfTextAtSize(TITLE, TITLE_SIZE);
  txt(ctx, TITLE, (PW - titleW) / 2, TY + 4, TITLE_SIZE, bold);

  // ── 2. PROJECT INFO ─────────────────────────────────────────────────────
  let y = TY - 22; // top of first row

  const L_W = 340; // left column width
  const R_X = ML + L_W;
  const R_W = CW - L_W; // 200

  // Row: Permit No. | File No.
  labelCell(ctx, ML,  y, L_W, ROW_H, 65,  "Permit No.:",            sanitizeText(test.permitNo || ""));
  labelCell(ctx, R_X, y, R_W, ROW_H, 48,  "File No.:",              sanitizeText(test.fileNo || ""));
  y -= ROW_H;

  // Row: MEI Project No. & Name (full width)
  labelCell(ctx, ML, y, CW, ROW_H, 130, "MEI Project No. & Name:", sanitizeText(test.meiProjectNoName || ""));
  y -= ROW_H;

  // Row: Contractor | Sub-Contractor
  labelCell(ctx, ML,  y, L_W, ROW_H, 65, "Contractor:",    sanitizeText(test.contractor || ""));
  labelCell(ctx, R_X, y, R_W, ROW_H, 80, "Sub-Contractor:", sanitizeText(test.subContractor || ""));
  y -= ROW_H;

  // Rows: Building / Footing / Post-tension / Masonry Wall
  //       Floor Deck / Columns / Walls / Masonry Columns
  //       Other / Slab-on-grade / Beams / Masonry Prisms
  const BLDG_W = 90;
  const FPM_W  = Math.round((CW - BLDG_W) / 3); // ~150
  const REM_W  = CW - BLDG_W - 2 * FPM_W;        // absorbs rounding

  const bool = (v: unknown) => v ? "Yes" : "";

  labelCell(ctx, ML,                       y, BLDG_W, ROW_H, 62, "Building No.:",    sanitizeText(test.buildingNo || ""));
  labelCell(ctx, ML + BLDG_W,              y, FPM_W,  ROW_H, 44, "Footing:",         bool(test.footing));
  labelCell(ctx, ML + BLDG_W + FPM_W,     y, FPM_W,  ROW_H, 65, "Post-tension:",    bool(test.postTension));
  labelCell(ctx, ML + BLDG_W + 2 * FPM_W, y, REM_W,  ROW_H, 75, "Masonry Wall:",    bool(test.masonryWall));
  y -= ROW_H;

  labelCell(ctx, ML,                       y, BLDG_W, ROW_H, 55, "Floor Deck:",       sanitizeText(test.floorDeck || ""));
  labelCell(ctx, ML + BLDG_W,              y, FPM_W,  ROW_H, 50, "Columns:",          bool(test.columns));
  labelCell(ctx, ML + BLDG_W + FPM_W,     y, FPM_W,  ROW_H, 38, "Walls:",            bool(test.walls));
  labelCell(ctx, ML + BLDG_W + 2 * FPM_W, y, REM_W,  ROW_H, 90, "Masonry Columns:", bool(test.masonryColumns));
  y -= ROW_H;

  labelCell(ctx, ML,                       y, BLDG_W, ROW_H, 35, "Other:",          sanitizeText(test.other || ""));
  labelCell(ctx, ML + BLDG_W,              y, FPM_W,  ROW_H, 65, "Slab-on-grade:", bool(test.slabOnGrade));
  labelCell(ctx, ML + BLDG_W + FPM_W,     y, FPM_W,  ROW_H, 40, "Beams:",         bool(test.beams));
  labelCell(ctx, ML + BLDG_W + 2 * FPM_W, y, REM_W,  ROW_H, 80, "Masonry Prisms:", bool(test.masonryPrisms));
  y -= ROW_H;

  // Row: Specific Location (grid) — full width
  labelCell(ctx, ML, y, CW, ROW_H, 115, "Specific Location (grid):", sanitizeText(test.specificLocation || ""));
  y -= ROW_H + 8;

  // ── 4. SAMPLE INFORMATION ───────────────────────────────────────────────
  const COL3 = Math.round(CW / 3); // 180

  // Supplier | Material | Sampled by
  labelCell(ctx, ML,            y, COL3,          ROW_H, 45, "Supplier:",    sanitizeText(test.supplier || ""));
  labelCell(ctx, ML + COL3,     y, COL3,          ROW_H, 50, "Material:",    sanitizeText(test.material || ""));
  labelCell(ctx, ML + 2 * COL3, y, CW - 2 * COL3, ROW_H, 60, "Sampled by:", sanitizeText(test.sampledBy || ""));
  y -= ROW_H;

  // Ticket No. | Date Sampled | Time
  labelCell(ctx, ML,            y, COL3,          ROW_H, 55, "Ticket No.:",   sanitizeText(test.ticketNo || ""));
  labelCell(ctx, ML + COL3,     y, COL3,          ROW_H, 75, "Date Sampled:", test.dateSampled ? new Date(test.dateSampled).toLocaleDateString() : "");
  labelCell(ctx, ML + 2 * COL3, y, CW - 2 * COL3, ROW_H, 30, "Time:",         test.time || "");
  y -= ROW_H;

  // Load No. | Date Received | Set No.
  labelCell(ctx, ML,            y, COL3,          ROW_H, 50, "Load No.:",      sanitizeText(test.loadNo || ""));
  labelCell(ctx, ML + COL3,     y, COL3,          ROW_H, 78, "Date Received:", test.dateReceived ? new Date(test.dateReceived).toLocaleDateString() : "");
  labelCell(ctx, ML + 2 * COL3, y, CW - 2 * COL3, ROW_H, 38, "Set No.:",       sanitizeText(test.setNo || ""));
  y -= ROW_H;

  // Truck No. | Weather
  labelCell(ctx, ML,        y, COL3,      ROW_H, 50, "Truck No.", sanitizeText(test.truckNo || ""));
  labelCell(ctx, ML + COL3, y, 2 * COL3, ROW_H, 50, "Weather:",  sanitizeText(test.weather || ""));
  y -= ROW_H;

  // ── 5. SPECIFIED / MEASURED SECTION ─────────────────────────────────────
  //  Layout per row:
  //    [left label+value (295px)] | [SM label (88px)] | [Specified (96px)] | [Measured (~97px)]
  const SM_X   = ML + 295;          // start of right (SM) portion
  const SM_W   = MR - SM_X;         // total SM width = 281
  const SM_LW  = 88;                 // SM row-label column width
  const SM_VW  = Math.round((SM_W - SM_LW) / 2); // ~96 per value col
  const SM_REM = SM_W - SM_LW - SM_VW;            // last column (absorbs rounding)

  // — Header row: "Mix Design No." on left + "Specified" / "Measured" headers —
  labelCell(ctx, ML, y, SM_X - ML, ROW_H, 80, "Mix Design No.:", sanitizeText(test.mixDesignNo || ""));

  // Empty gray label cell (left of Specified/Measured headers)
  fillRect(ctx, SM_X, y - ROW_H, SM_LW, ROW_H, GRAY_BG);
  borderRect(ctx, SM_X, y - ROW_H, SM_LW, ROW_H);

  // "Specified" header cell
  fillRect(ctx, SM_X + SM_LW, y - ROW_H, SM_VW, ROW_H, GRAY_BG);
  borderRect(ctx, SM_X + SM_LW, y - ROW_H, SM_VW, ROW_H);
  const sHdr = "Specified";
  txt(ctx, sHdr, SM_X + SM_LW + (SM_VW - bold.widthOfTextAtSize(sHdr, 7.5)) / 2, y - ROW_H + 4, 7.5, bold);

  // "Measured" header cell
  fillRect(ctx, SM_X + SM_LW + SM_VW, y - ROW_H, SM_REM, ROW_H, GRAY_BG);
  borderRect(ctx, SM_X + SM_LW + SM_VW, y - ROW_H, SM_REM, ROW_H);
  const mHdr = "Measured";
  txt(ctx, mHdr, SM_X + SM_LW + SM_VW + (SM_REM - bold.widthOfTextAtSize(mHdr, 7.5)) / 2, y - ROW_H + 4, 7.5, bold);
  y -= ROW_H;

  // — Reusable helper for the 4 data rows —
  const LEFT_LW = 100; // left label-column width inside the SM data rows

  const smRow = (
    leftLabel: string, leftVal: string,
    smLabel: string,
    specVal: string, measVal: string
  ) => {
    labelCell(ctx, ML, y, SM_X - ML, ROW_H, LEFT_LW, leftLabel, leftVal);

    // SM label (gray)
    fillRect(ctx, SM_X, y - ROW_H, SM_LW, ROW_H, GRAY_BG);
    borderRect(ctx, SM_X, y - ROW_H, SM_LW, ROW_H);
    txt(ctx, smLabel, SM_X + 3, y - ROW_H + 4, 7, bold);

    // Specified value
    borderRect(ctx, SM_X + SM_LW, y - ROW_H, SM_VW, ROW_H);
    txt(ctx, specVal, SM_X + SM_LW + 3, y - ROW_H + 4, 7.5, regular);

    // Measured value
    borderRect(ctx, SM_X + SM_LW + SM_VW, y - ROW_H, SM_REM, ROW_H);
    txt(ctx, measVal, SM_X + SM_LW + SM_VW + 3, y - ROW_H + 4, 7.5, regular);

    y -= ROW_H;
  };

  smRow(
    "Cement Factor, Sk/CY:", String(test.cementFactorSkCy ?? ""),
    "Slump, In.",
    String(test.slumpInSpecified ?? ""),
    String(test.slumpInMeasured ?? ""),
  );
  smRow(
    "Max. Size Agg., In.:", String(test.maxSizeAggIn ?? ""),
    "Mix Temp., \u00b0F",
    String(test.mixTempFSpecified ?? ""),
    String(test.mixTempFMeasured ?? ""),
  );
  smRow(
    "Admixture:", sanitizeText(test.admixture || ""),
    "Air Temp., \u00b0F",
    String(test.airTempFSpecified ?? ""),
    String(test.airTempFMeasured ?? ""),
  );
  smRow(
    "Specified Strength, PSI:", String(test.specifiedStrengthPsi ?? ""),
    "Air Content, %",
    String(test.airContentSpecified ?? ""),
    String(test.airContentMeasured ?? ""),
  );

  y -= 8;

  // ── 6. SPECIMEN DATA TABLE ───────────────────────────────────────────────
  const specimens = parseSpecimens(test.specimens).filter(hasVisibleSpecimenData);
  const NUM_COLS = Math.max(specimens.length, 1);
  const SPEC_LABEL_W = 155;
  const SPEC_COL_W   = (CW - SPEC_LABEL_W) / NUM_COLS;
  const SPEC_ROW_H   = 16;

  const specRowDefs: { label: string; key: keyof Specimen | string }[] = [
    { label: "Specimen No.",              key: "specimenNo" },
    { label: "Set No.",                   key: "setNo" },
    { label: "Aged, Days",                key: "agedDays" },
    { label: "Date tested",               key: "dateTested" },
    { label: "Dimensions, in x in",       key: "dimensions" },
    { label: "Area, Square In.",          key: "areaSquareIn" },
    { label: "Ultimate Load, Lbs",        key: "ultimateLoadLbs" },
    { label: "Compressive Strength (PSI)", key: "compressiveStrengthPsi" },
    { label: "Average Strength (PSI)",    key: "averageStrengthPsi" },
    { label: "Lab Technician",            key: "labTechnician" },
    { label: "Lab Manager",               key: "labManager" },
  ];

  const specTableTop = y;

  for (let r = 0; r < specRowDefs.length; r++) {
    const rowY = specTableTop - r * SPEC_ROW_H;

    // Gray label cell
    fillRect(ctx, ML, rowY - SPEC_ROW_H, SPEC_LABEL_W, SPEC_ROW_H, GRAY_BG);
    borderRect(ctx, ML, rowY - SPEC_ROW_H, SPEC_LABEL_W, SPEC_ROW_H);
    txt(ctx, specRowDefs[r].label, ML + 3, rowY - SPEC_ROW_H + 5, 7, bold);

    // Data columns
    for (let c = 0; c < NUM_COLS; c++) {
      const cellX = ML + SPEC_LABEL_W + c * SPEC_COL_W;
      borderRect(ctx, cellX, rowY - SPEC_ROW_H, SPEC_COL_W, SPEC_ROW_H);

      if (c < specimens.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = (specimens[c] as any)[specRowDefs[r].key];
        const val = raw != null ? sanitizeText(String(raw)) : "";
        if (val) {
          txt(ctx, val, cellX + 2, rowY - SPEC_ROW_H + 5, 6.5, regular);
        }
      }
    }
  }

  y = specTableTop - specRowDefs.length * SPEC_ROW_H - 14;

  // ── 7. BOTTOM TEXT + COMMENTS ──────────────────────────────────────────
  const commentMinY = 52;
  const commentLineHeight = 11;
  const commentWidth = CW - 6;
  const commentStartY = y;
  const commentTitleGap = 16;
  const paragraphGap = 5;
  const commentParagraphs = String(test.comments ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((paragraph) => sanitizeText(paragraph));

  const startConcreteCommentPage = () => {
    drawConcreteFooter(ctx, ML, MR, PW, regular);
    page = pdfDoc.addPage([PW, PH]);
    ctx = { page, bold, regular };
    y = PH - 56;
  };

  const ensureCommentSpace = (heightNeeded: number) => {
    if (y - heightNeeded < commentMinY) {
      startConcreteCommentPage();
    }
  };

  txt(ctx, "Comments:", ML, commentStartY, 8.5, bold);
  y = commentStartY - commentTitleGap;

  if (commentParagraphs.some((paragraph) => paragraph.trim().length > 0)) {
    for (const paragraph of commentParagraphs) {
      const lines = paragraph ? wrapText(regular, paragraph, 8, commentWidth) : [""];

      for (const line of lines) {
        ensureCommentSpace(commentLineHeight);
        if (line) {
          txt(ctx, line, ML + 3, y, 8, regular);
        }
        y -= commentLineHeight;
      }

      y -= paragraphGap;
    }
  } else {
    ensureCommentSpace(commentLineHeight);
    txt(ctx, "-", ML + 3, y, 8, regular);
    y -= commentLineHeight;
  }

  // ── 8. FOOTER ──────────────────────────────────────────────────────────

  // ── 9. ATTACHMENTS (new page) ──────────────────────────────────────────
  if (attachments?.length) {
    let attachmentPage = page;
    let attachmentCtx: Ctx = ctx;
    let attachmentY = y - 8;
    const imageColumnGap = 8;
    const imageColumns = 3;
    const imageCellWidth = (CW - imageColumnGap * (imageColumns - 1)) / imageColumns;
    const imageMaxHeight = 120;
    const attachmentMinY = 52;

    const ensureAttachmentSpace = (heightNeeded: number) => {
      if (attachmentY - heightNeeded <= attachmentMinY) {
        drawConcreteFooter(attachmentCtx, ML, MR, PW, regular);
        attachmentPage = pdfDoc.addPage([PW, PH]);
        attachmentCtx = { page: attachmentPage, bold, regular };
        attachmentY = PH - 56;
        txt(attachmentCtx, "Attachments", ML, attachmentY, 12, bold);
        attachmentY -= 18;
      }
    };

    const drawAttachmentText = (prefix: string, body: string) => {
      const lines = wrapText(regular, `${prefix} ${body}`, 8, CW - 6);
      ensureAttachmentSpace(lines.length * 10 + 6);
      for (const line of lines) {
        txt(attachmentCtx, line, ML + 3, attachmentY, 8, regular);
        attachmentY -= 10;
      }
      attachmentY -= 4;
    };

    const drawImageRow = (images: Array<{ image: PDFImage; width: number; height: number }>) => {
      if (!images.length) return;
      const rowHeight = Math.max(...images.map((item) => item.height));
      ensureAttachmentSpace(rowHeight + 10);
      let x = ML;
      for (const item of images) {
        const yOffset = (rowHeight - item.height) / 2;
        attachmentCtx.page.drawImage(item.image, {
          x,
          y: attachmentY - yOffset - item.height,
          width: item.width,
          height: item.height,
        });
        x += imageCellWidth + imageColumnGap;
      }
      attachmentY -= rowHeight + 10;
    };

    ensureAttachmentSpace(28);
    txt(attachmentCtx, "Attachments", ML, attachmentY, 12, bold);
    attachmentY -= 18;

    const pendingImages: Array<{ image: PDFImage; width: number; height: number }> = [];

    for (const att of attachments) {
      const mimeType = String(att.mimeType || "application/octet-stream").toLowerCase();
      const safeName = sanitizeText(att.fileName || "Attachment");
      const safeMimeLabel = sanitizeText(mimeType) || "attachment";

      if (mimeType.startsWith("image/")) {
        try {
          const fileBytes = await fetchImageBytes(att.fileKey, att.fileUrl);
          if (!fileBytes) throw new Error("preview unavailable");
          const imageBytes = new Uint8Array(fileBytes);
          const imageFormat = detectImageFormat(safeName, mimeType, imageBytes);
          if (!imageFormat) throw new Error("unsupported image bytes");
          let image;
          if (imageFormat === "png") {
            image = await pdfDoc.embedPng(imageBytes);
          } else if (imageFormat === "jpg") {
            image = await pdfDoc.embedJpg(imageBytes);
          } else if (imageFormat === "webp" || imageFormat === "heic") {
            try {
              const converted = await sharp(Buffer.from(imageBytes)).jpeg({ quality: 90 }).toBuffer();
              image = await pdfDoc.embedJpg(converted);
            } catch (convErr) {
              throw new Error(`conversion failed: ${convErr instanceof Error ? convErr.message : String(convErr)}`);
            }
          } else {
            throw new Error("unsupported image bytes");
          }
          const dims = image.scale(1);
          const scale = Math.min(imageCellWidth / dims.width, imageMaxHeight / dims.height, 1);
          pendingImages.push({
            image,
            width: dims.width * scale,
            height: dims.height * scale,
          });
          if (pendingImages.length === imageColumns) {
            drawImageRow(pendingImages.splice(0, pendingImages.length));
          }
        } catch {
          if (pendingImages.length) drawImageRow(pendingImages.splice(0, pendingImages.length));
          drawAttachmentText("[IMAGE]", "Image attachment could not be rendered");
        }
        continue;
      }

      if (pendingImages.length) drawImageRow(pendingImages.splice(0, pendingImages.length));
      drawAttachmentText("[FILE]", `${safeName} (${safeMimeLabel})`);
    }

    if (pendingImages.length) drawImageRow(pendingImages.splice(0, pendingImages.length));

    drawConcreteFooter(attachmentCtx, ML, MR, PW, regular);
  } else {
    drawConcreteFooter(ctx, ML, MR, PW, regular);
  }

  return Buffer.from(await pdfDoc.save());
}



