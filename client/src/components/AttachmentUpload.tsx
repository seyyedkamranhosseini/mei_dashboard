import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, File, Download } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface AttachmentUploadProps {
  formType: "daily" | "concrete";
  formId: number;
  onUploadComplete?: () => void;
}

export function AttachmentUpload({ formType, formId, onUploadComplete }: AttachmentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: attachments, refetch } = trpc.attachment.getAttachments.useQuery({
    formType,
    formId,
  });

  const uploadMutation = trpc.attachment.uploadAttachment.useMutation();
  const deleteMutation = trpc.attachment.deleteAttachment.useMutation();
  const utils = trpc.useUtils();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        // Validate file size (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large (max 50MB)`);
          continue;
        }

        const buffer = await file.arrayBuffer();
        await uploadMutation.mutateAsync({
          formType,
          formId,
          fileName: file.name,
          fileData: new Uint8Array(buffer) as any,
          mimeType: file.type || "application/octet-stream",
        });

        toast.success(`${file.name} uploaded successfully`);
      }

      await refetch();
      onUploadComplete?.();
    } catch (error) {
      toast.error("Failed to upload file");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (attachmentId: number) => {
    try {
      await deleteMutation.mutateAsync(attachmentId);
      await refetch();
      toast.success("Attachment deleted");
    } catch (error) {
      toast.error("Failed to delete attachment");
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      // Direct download from the provided URL
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      toast.error("Failed to download file");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const isImageFile = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm font-medium text-gray-900">
          Drag and drop files here, or click to select
        </p>
        <p className="text-xs text-gray-500">
          Supported formats: images, PDFs, documents (max 50MB each)
        </p>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          id="file-input"
        />
        <Button
          asChild
          variant="outline"
          className="mt-4"
          disabled={isUploading}
        >
          <label htmlFor="file-input" className="cursor-pointer">
            {isUploading ? "Uploading..." : "Select Files"}
          </label>
        </Button>
      </Card>

      {attachments && attachments.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Attachments ({attachments.length})
          </h3>
          
          {/* Image Gallery */}
          {attachments.some(a => isImageFile(a.mimeType)) && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-600">Images</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {attachments
                  .filter(a => isImageFile(a.mimeType))
                  .map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
                    >
                      <img
                        src={attachment.fileUrl}
                        alt={attachment.fileName}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white hover:bg-white/20"
                          onClick={() =>
                            handleDownload(attachment.fileUrl, attachment.fileName)
                          }
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white hover:bg-white/20"
                          onClick={() => handleDelete(attachment.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-600 p-1 truncate">
                        {attachment.fileName}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
          
          {/* Other Files List */}
          {attachments.some(a => !isImageFile(a.mimeType)) && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-600">Documents & Files</h4>
              <div className="space-y-2">
                {attachments
                  .filter(a => !isImageFile(a.mimeType))
                  .map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <File className="h-5 w-5 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {attachment.fileName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(attachment.fileSize)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleDownload(attachment.fileUrl, attachment.fileName)
                          }
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(attachment.id)}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
