/**
 * AttachmentGallery
 *
 * Shows existing attachments for a saved form (using presigned URLs),
 * allows uploading new files, and deleting existing ones.
 *
 * Usage (edit form — formId known upfront):
 *   <AttachmentGallery formType="daily" formId={formId} />
 *
 * Usage (create form — formId only known after submit):
 *   <AttachmentGallery formType="daily" formId={null} onStagedFilesChange={setStagedFiles} />
 *   Then after report is created, call uploadStagedFiles(newFormId).
 */

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { normalizeCollection } from "@/lib/normalize-collection";
import { Loader2, Trash2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  formType: "daily" | "concrete";
  /** Pass the saved form ID to load/manage existing attachments.
   *  Pass null when the form hasn't been submitted yet (create mode). */
  formId: number | null;
  /** Optional: called whenever staged (pre-submit) files change */
  onStagedFilesChange?: (files: File[]) => void;
  /** Optional: view-only mode (no upload/delete) */
  readOnly?: boolean;
}

export function AttachmentGallery({ formType, formId, onStagedFilesChange, readOnly = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDeletionIds, setPendingDeletionIds] = useState<number[]>([]);

  // ── Staged files (create mode, before formId exists) ───────────────────
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [stagedPreviews, setStagedPreviews] = useState<string[]>([]);

  // ── Existing attachments with presigned URLs ────────────────────────────
  const {
    data: existingAttachments,
    isLoading: loadingAttachments,
    refetch,
  } = trpc.attachment.getAttachmentsWithUrls.useQuery(
    { formType, formId: formId! },
    { enabled: formId !== null && formId > 0 }
  );

  const uploadMutation = trpc.attachment.uploadAttachment.useMutation({
    onSuccess: () => refetch(),
    onError: () => toast.error("Failed to upload file"),
  });

  const deleteMutation = trpc.attachment.deleteAttachment.useMutation({
    onSuccess: (_data, attachmentId) => {
      setPendingDeletionIds((current) => current.filter((id) => id !== attachmentId));
      refetch();
    },
    onError: (_error, attachmentId) => {
      setPendingDeletionIds((current) => current.filter((id) => id !== attachmentId));
      toast.error("Failed to delete file");
    },
  });

  // ── File picking ────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (fileInputRef.current) fileInputRef.current.value = "";

    if (formId === null) {
      // Create mode — stage locally
      const newFiles = [...stagedFiles, ...files];
      const newPreviews = [...stagedPreviews];

      for (const file of files) {
        if (file.type.startsWith("image/")) {
          const dataUrl = await readAsDataUrl(file);
          newPreviews.push(dataUrl);
        } else {
          newPreviews.push("");
        }
      }

      setStagedFiles(newFiles);
      setStagedPreviews(newPreviews);
      onStagedFilesChange?.(newFiles);
    } else {
      // Edit mode — upload immediately
      setUploading(true);
      try {
        for (const file of files) {
          const buffer = await file.arrayBuffer();
          await uploadMutation.mutateAsync({
            formType,
            formId,
            fileName: file.name,
            fileData: new Uint8Array(buffer),
            mimeType: file.type,
          });
        }
        toast.success(`${files.length} file(s) uploaded`);
      } finally {
        setUploading(false);
      }
    }
  };

  const removeStagedFile = (index: number) => {
    const newFiles = stagedFiles.filter((_, i) => i !== index);
    const newPreviews = stagedPreviews.filter((_, i) => i !== index);
    setStagedFiles(newFiles);
    setStagedPreviews(newPreviews);
    onStagedFilesChange?.(newFiles);
  };

  const isImage = (mimeType: string) => mimeType.startsWith("image/");

  const isBusy = uploading || uploadMutation.isPending || deleteMutation.isPending;
  const { items: normalizedExistingAttachments, issue: attachmentIssue } = normalizeCollection<any>(
    existingAttachments,
    `${formType} attachment`
  );
  const visibleExistingAttachments = normalizedExistingAttachments.filter(
    (att: any) => !pendingDeletionIds.includes(att.id)
  );

  const handleExistingDelete = (attachmentId: number) => {
    setPendingDeletionIds((current) =>
      current.includes(attachmentId) ? current : [...current, attachmentId]
    );
    deleteMutation.mutate(attachmentId);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const hasContent =
    visibleExistingAttachments.length > 0 || stagedFiles.length > 0;

  return (
    <div className="space-y-3">
      {attachmentIssue && (
        <Alert>
          <AlertDescription>{attachmentIssue}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Attachments</h3>
          <p className="text-sm text-muted-foreground">
            {formId === null
              ? "Add photos or documents — they'll upload when you submit"
              : "Photos and documents for this report"}
          </p>
        </div>
        {!readOnly && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
            >
              {isBusy ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" />Add Files</>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.rtf"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      {/* Loading state */}
      {loadingAttachments && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Grid */}
      {!loadingAttachments && hasContent ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Existing saved attachments */}
          {visibleExistingAttachments.map((att: any) => (
            <AttachmentCard
              key={att.id}
              name={att.fileName}
              url={att.signedUrl}
              isImage={isImage(att.mimeType)}
              onDelete={() => handleExistingDelete(att.id)}
              deleting={pendingDeletionIds.includes(att.id)}
              readOnly={readOnly}
            />
          ))}

          {/* Staged (not yet uploaded) files */}
          {stagedFiles.map((file, i) => (
            <AttachmentCard
              key={`staged-${i}`}
              name={file.name}
              url={stagedPreviews[i] || ""}
              isImage={file.type.startsWith("image/")}
              onDelete={() => removeStagedFile(i)}
              staged
              readOnly={readOnly}
            />
          ))}
        </div>
      ) : (
        !loadingAttachments && !readOnly && (
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto h-8 w-8 mb-2 opacity-40" />
            Click or tap to add photos or documents
          </div>
        )
      )}
    </div>
  );
}

// ── Sub-component: single attachment card ───────────────────────────────────

interface CardProps {
  name: string;
  url: string;
  isImage: boolean;
  onDelete: () => void;
  deleting?: boolean;
  staged?: boolean;
  readOnly?: boolean;
}

function AttachmentCard({ name, url, isImage, onDelete, deleting, staged, readOnly = false }: CardProps) {
  return (
    <div className="relative group border rounded-lg overflow-hidden bg-gray-50">
      {/* Preview */}
      {isImage && url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={name} className="w-full h-32 object-cover" />
        </a>
      ) : (
        <a
          href={url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-32 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-gray-600"
        >
          <FileText className="h-10 w-10" />
          <span className="text-xs px-2 truncate w-full text-center">{name}</span>
        </a>
      )}

      {/* Filename bar */}
      <div className="p-1.5 bg-white border-t flex items-center gap-1">
        {staged && (
          <span className="text-xs bg-yellow-100 text-yellow-700 rounded px-1 shrink-0">
            pending
          </span>
        )}
        <p className="text-xs text-gray-600 truncate">{name}</p>
      </div>

      {/* Delete button (hover) */}
      {!readOnly && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
          title="Remove"
        >
          {deleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
}

// ── Helper ──────────────────────────────────────────────────────────────────

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Call this from the create form's onSubmit after the report ID is known,
 * to upload all staged files.
 */
export async function uploadStagedFiles(
  files: File[],
  formType: "daily" | "concrete",
  formId: number,
  uploadFn: (args: {
    formType: "daily" | "concrete";
    formId: number;
    fileName: string;
    fileData: Uint8Array<ArrayBuffer>;
    mimeType: string;
  }) => Promise<any>
): Promise<{ uploadedCount: number; failedFiles: string[] }> {
  const failedFiles: string[] = [];
  let uploadedCount = 0;

  for (const file of files) {
    try {
      const buffer = await file.arrayBuffer();
      await uploadFn({
        formType,
        formId,
        fileName: file.name,
        fileData: new Uint8Array(buffer) as Uint8Array<ArrayBuffer>,
        mimeType: file.type,
      });
      uploadedCount += 1;
    } catch (err) {
      console.error("Failed to upload attachment:", file.name, err);
      failedFiles.push(file.name);
    }
  }

  return { uploadedCount, failedFiles };
}
