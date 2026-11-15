import type { ProductImportPort } from '../../ports';
import type { PresignedUploader } from './s3/uploader';
import type { ImportUploadClient } from './stores/storesService';

/**
 * Excel import in three steps (BR-CAT-17): ask stores-service for a presigned upload of exactly this size → PUT the file
 * straight to the store's import folder → import it by the name the server chose. Each step starts only after the
 * previous one succeeded, so nothing is imported after a failed upload. The upload is used at once (valid 15 minutes).
 */
export function createProductImportAdapter(client: ImportUploadClient, uploader: PresignedUploader): ProductImportPort {
  return {
    async importFile(merchantId, storeId, file) {
      const upload = await client.requestUpload(merchantId, storeId, file.size);
      await uploader.put(upload, file);
      return client.startImport(merchantId, storeId, upload.fileName);
    },
  };
}
