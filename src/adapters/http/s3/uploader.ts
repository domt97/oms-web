import { AppError } from '../../../domain/errors';

/** A presigned upload from stores-service: PUT the file to `uploadUrl` with exactly `headers`. */
export interface PresignedUpload {
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
}

/** A 5 MB file on a slow mobile link; the URL itself is valid 15 minutes (BR-CAT-17). */
export const UPLOAD_TIMEOUT_MS = 120_000;

export const UPLOAD_REFUSED_MESSAGE =
  'File storage refused the upload (the link expired or the file changed). Choose the file and try again; if it keeps failing, contact support.';
export const UPLOAD_UNREACHABLE_MESSAGE = 'Cannot reach file storage, or it refused the upload.';
export const UPLOAD_TIMEOUT_MESSAGE = 'The upload did not finish in time.';
export const UPLOAD_BAD_LINK_MESSAGE = 'The upload link from the server is not valid. Contact support.';

export interface PresignedUploader {
  put(upload: PresignedUpload, body: Blob): Promise<void>;
}

/**
 * The one call that goes straight from the browser to another origin: file storage (S3, LocalStack locally), allowed
 * by the bucket's CORS rule (`development` repo). It cannot use the API client: that adds Accept and X-Request-Id,
 * sends JSON and prefixes the API base URL. Only the signed headers are sent. The URL is a bearer link: it is never put
 * in an error message.
 */
export function createPresignedUploader(options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): PresignedUploader {
  const doFetch = options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? UPLOAD_TIMEOUT_MS;

  return {
    async put(upload, body) {
      if (!/^https?:\/\//i.test(upload.uploadUrl)) throw new AppError(0, UPLOAD_BAD_LINK_MESSAGE);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await doFetch(upload.uploadUrl, { method: upload.method, headers: upload.headers, body, signal: controller.signal });
        // S3 answers with an empty body or a short XML error; read it so the connection is released.
        await response.text().catch(() => undefined);
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === 'AbortError';
        throw new AppError(0, aborted ? UPLOAD_TIMEOUT_MESSAGE : UPLOAD_UNREACHABLE_MESSAGE);
      } finally {
        clearTimeout(timer);
      }
      if (response.status === 403) throw new AppError(403, UPLOAD_REFUSED_MESSAGE);
      if (!response.ok) throw new AppError(response.status, `File storage rejected the upload (HTTP ${response.status}).`);
    },
  };
}
