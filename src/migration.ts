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
    const blobMetadataList = blobContainer.listBlobs();

    const workers = new Array(maxConcurrentDocuments)
      .fill(blobMetadataList)
      .map(async (blobMetadataList) => {
        for await (const blobMetadata of blobMetadataList) {
          const s3ObjectName = mapS3ObjectName(blobMetadata.name);

          const objectExists = await s3Bucket.doesObjectExist(
            s3ObjectName,
            blobMetadata.contentLength
          );
          if (objectExists) {
            continue;
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
        }
      });

    await Promise.all(workers);
  };
