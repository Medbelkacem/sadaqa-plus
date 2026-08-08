'use client';

import * as React from 'react';
import { FileText, Loader2, Paperclip, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';
import { cn, formatBytes } from '@/lib/utils';

export type UploadedFile = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * File picker with per-file upload.
 *
 * Client-side type and size checks are a courtesy to the user — the server
 * re-validates everything, including sniffing the magic bytes, and is the
 * only thing that actually decides what is accepted.
 */
export function FileUploader({
  value,
  onChange,
  max = 6,
  hint,
  label,
}: {
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  max?: number;
  hint?: string;
  label?: string;
}) {
  const { t } = useI18n();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError(null);

    const remaining = max - value.length;
    const chosen = Array.from(fileList).slice(0, Math.max(0, remaining));
    if (chosen.length === 0) return;

    setUploading(true);
    const uploaded: UploadedFile[] = [];

    for (const file of chosen) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name} — ${t.errors.fileTooLarge}`);
        continue;
      }
      if (!ACCEPT.split(',').includes(file.type)) {
        setError(`${file.name} — ${t.errors.fileTypeRejected}`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        uploaded.push(await api.upload<UploadedFile>('/api/files', formData));
      } catch (uploadError) {
        setError(
          uploadError instanceof ApiClientError ? uploadError.message : t.errors.genericBody,
        );
      }
    }

    setUploading(false);
    if (uploaded.length > 0) onChange([...value, ...uploaded]);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          'rounded-[var(--radius-card)] border border-dashed p-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary-soft/50' : 'border-border bg-surface-muted/50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          id="file-uploader-input"
          onChange={(event) => void handleFiles(event.target.files)}
          disabled={uploading || value.length >= max}
        />

        <Paperclip className="mx-auto size-6 text-muted-fg" aria-hidden="true" />

        <p className="mt-3 text-sm font-medium text-foreground">
          {label ?? t.requests.steps.attachments}
        </p>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-muted-fg">{hint}</p> : null}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4"
          loading={uploading}
          disabled={value.length >= max}
          onClick={() => inputRef.current?.click()}
        >
          {t.common.create}
        </Button>

        <p className="mt-2 text-xs text-muted-fg">
          {value.length}/{max} · {formatBytes(MAX_BYTES)} max
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              {file.mimeType.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/${file.id}`}
                  alt=""
                  className="size-9 shrink-0 rounded object-cover"
                />
              ) : (
                <FileText className="size-9 shrink-0 p-2 text-muted-fg" aria-hidden="true" />
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{file.originalName}</span>
                <span className="block text-xs text-muted-fg">{formatBytes(file.sizeBytes)}</span>
              </span>

              <button
                type="button"
                onClick={() => onChange(value.filter((entry) => entry.id !== file.id))}
                className="rounded-md p-1.5 text-muted-fg transition-colors hover:bg-surface-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${t.common.delete} ${file.originalName}`}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {uploading ? (
        <p className="flex items-center gap-2 text-xs text-muted-fg" aria-live="polite">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {t.common.loading}
        </p>
      ) : null}
    </div>
  );
}
