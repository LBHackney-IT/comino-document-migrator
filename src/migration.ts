import { Sema } from "async-sema";
import retry from "async-retry";
import { BlobContainer, S3Bucket } from "./storage";

export interface MigrationConfig {
  blobContainer: BlobContainer;
  s3Bucket: S3Bucket;
  s3ObjectNameMapper: (blobName: string) => string;
  maxConcurrentDocuments?: number;
  maxRetriesPerDocument?: number;
}

export const createMigration =
  ({
    blobContainer,
    s3Bucket,
    s3ObjectNameMapper: mapS3ObjectName,
    maxConcurrentDocuments = 32,
    maxRetriesPerDocument = 10,
  }: MigrationConfig) =>
  async () => {
    const sema = new Sema(maxConcurrentDocuments);
    const blobMetadataList = blobContainer.listBlobs();

    for await (const blobMetadata of blobMetadataList) {
      await sema.acquire();

      (async () => {
        const s3ObjectName = mapS3ObjectName(blobMetadata.name);

        const objectExists = await s3Bucket.doesObjectExist(
          s3ObjectName,
          blobMetadata.contentLength
        );
        if (objectExists) {
          return;
        }

        await retry(
          async () => {
            const content = await blobContainer.getBlobContent(
              blobMetadata.name
            );
            await s3Bucket.putObjectStream(
              s3ObjectName,
              content.contentType,
              content.body
            );
          },
          { retries: maxRetriesPerDocument }
        );
      })().finally(() => sema.release());
    }

    await sema.drain();
  };
