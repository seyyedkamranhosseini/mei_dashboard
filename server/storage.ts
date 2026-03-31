// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from './_core/env';
import fs from "fs";
import path from "path";

type StorageConfig = { baseUrl: string; apiKey: string };

const LOCAL_UPLOAD_DIR = path.resolve(import.meta.dirname, "..", "uploads");

function hasRemoteStorageConfig(): boolean {
  return Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);
}

function sanitizeKey(key: string): string {
  return key.replace(/\.\.[/\\]/g, "");
}

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

function buildDeleteUrls(baseUrl: string, relKey: string): URL[] {
  const normalizedKey = normalizeKey(relKey);
  const candidates = [
    new URL("v1/storage/delete", ensureTrailingSlash(baseUrl)),
    new URL("v1/storage/object", ensureTrailingSlash(baseUrl)),
  ];

  for (const url of candidates) {
    url.searchParams.set("path", normalizedKey);
  }

  return candidates;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  if (!hasRemoteStorageConfig()) {
    const safeKey = sanitizeKey(key);
    const targetPath = path.join(LOCAL_UPLOAD_DIR, safeKey);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);
    await fs.promises.writeFile(targetPath, buffer);
    return { key: safeKey, url: `/uploads/${safeKey}` };
  }

  const { baseUrl, apiKey } = getStorageConfig();
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const key = normalizeKey(relKey);
  if (!hasRemoteStorageConfig()) {
    const safeKey = sanitizeKey(key);
    return { key: safeKey, url: `/uploads/${safeKey}` };
  }
  const { baseUrl, apiKey } = getStorageConfig();
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

export async function storageRead(relKey: string): Promise<Buffer> {
  const key = normalizeKey(relKey);
  if (!hasRemoteStorageConfig()) {
    const safeKey = sanitizeKey(key);
    const targetPath = path.join(LOCAL_UPLOAD_DIR, safeKey);
    return await fs.promises.readFile(targetPath);
  }

  const { url } = await storageGet(key);
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage read failed (${response.status} ${response.statusText}): ${message}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function storageDelete(
  relKey: string
): Promise<{ key: string; deleted: boolean; missing: boolean }> {
  const key = normalizeKey(relKey);
  if (!hasRemoteStorageConfig()) {
    const safeKey = sanitizeKey(key);
    const targetPath = path.join(LOCAL_UPLOAD_DIR, safeKey);

    try {
      await fs.promises.unlink(targetPath);

      // Best-effort cleanup of now-empty parent folders inside uploads/.
      let currentDir = path.dirname(targetPath);
      while (currentDir.startsWith(LOCAL_UPLOAD_DIR) && currentDir !== LOCAL_UPLOAD_DIR) {
        try {
          await fs.promises.rmdir(currentDir);
          currentDir = path.dirname(currentDir);
        } catch {
          break;
        }
      }

      return { key: safeKey, deleted: true, missing: false };
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return { key: safeKey, deleted: false, missing: true };
      }
      throw error;
    }
  }

  const { baseUrl, apiKey } = getStorageConfig();
  const deleteUrls = buildDeleteUrls(baseUrl, key);
  const methods: Array<"DELETE" | "POST"> = ["DELETE", "POST"];
  let lastError: Error | null = null;

  for (const url of deleteUrls) {
    for (const method of methods) {
      try {
        const response = await fetch(url, {
          method,
          headers: buildAuthHeaders(apiKey),
        });

        if (response.ok) {
          return { key, deleted: true, missing: false };
        }

        if (response.status === 404) {
          return { key, deleted: false, missing: true };
        }

        lastError = new Error(
          `Storage delete failed (${response.status} ${response.statusText}) via ${method} ${url.pathname}`
        );
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw lastError ?? new Error(`Remote storage deletion failed for key: ${key}`);
}
