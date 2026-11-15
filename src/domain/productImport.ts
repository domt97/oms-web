/**
 * Product Excel import file check (BR-CAT-13, BR-CAT-17), shown before anything is sent. A hint only: stores-service
 * checks the size again when it signs the upload, and the import checks the file itself.
 */

/** 5 MB, the stores-service default `app.import.max-bytes`. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Why the file cannot be imported, or null when it can be uploaded. */
export function importFileProblem(name: string, size: number): string | null {
  if (!name.toLowerCase().endsWith('.xlsx')) return 'Choose an Excel file (.xlsx).';
  if (size < 1) return 'The file is empty.';
  if (size > MAX_IMPORT_BYTES) return 'The file is larger than 5 MB.';
  return null;
}
