import { Sema } from "async-sema";
import { BlobContainer, S3Bucket } from "./storage";

export interface MigrationConfig {
  blobContainer: BlobContainer;
  s3Bucket: S3Bucket;
  s3ObjectNameMapper: (blobName: string) => string;
  maxConcurrency: number;
}

export const createMigration =
  ({
    blobContainer,
    s3Bucket,
    s3ObjectNameMapper: mapS3ObjectName,
    maxConcurrency,
  }: MigrationConfig) =>
  async () => {
    const sema = new Sema(maxConcurrency);
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

        const blobStream = await blobContainer.getBlobStream(blobItem.name);
        await s3Bucket.putObjectStream(s3ObjectName, blobStream);
      })().finally(() => sema.release());
    }

    await sema.drain();
  };
