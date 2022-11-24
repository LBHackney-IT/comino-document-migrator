import { Sema } from "async-sema";
import retry from "async-retry";
import { BlobContainer, S3Bucket } from "./storage";

export interface MigrationConfig {
  blobContainer: BlobContainer;
  s3Bucket: S3Bucket;
  s3ObjectNameMapper: (blobName: string) => string;
  maxConcurrentDocuments: number;
  maxRetriesPerDocument: number;
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
    const blobItems = blobContainer.listBlobs();

    for await (const blobItem of blobItems) {
      await sema.acquire();

      (async () => {
        const s3ObjectName = mapS3ObjectName(blobItem.name);

        const objectExists = await s3Bucket.doesObjectExist(
          s3ObjectName,
          blobItem.properties.contentLength
        );
        if (objectExists) {
          return;
        }

        await retry(
          async () => {
            const content = await blobContainer.getBlobContent(blobItem.name);
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
