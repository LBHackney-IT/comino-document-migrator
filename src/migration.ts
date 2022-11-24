import { BlobItem } from "@azure/storage-blob";
import { Sema } from "async-sema";

export interface BlobToS3MigrationConfig {
  s3ObjectNameMap: (blobName: string) => string;
  blobToS3Predicate: (
    blobItem: BlobItem,
    s3ObjectName: string
  ) => Promise<boolean>;
  blobToS3Copy: (blobItem: BlobItem, s3ObjectName: string) => Promise<void>;
  maxConcurrency: number;
}

export const createBlobToS3Migration =
  ({
    s3ObjectNameMap: mapS3ObjectName,
    blobToS3Predicate: shouldCopyBlob,
    blobToS3Copy: copyBlobToS3,
    maxConcurrency,
  }: BlobToS3MigrationConfig) =>
  async (blobItems: AsyncIterable<BlobItem>) => {
    const sema = new Sema(maxConcurrency);

    const migrateBlobToS3 = async (blobItem: BlobItem) => {
      const s3ObjectName = mapS3ObjectName(blobItem.name);

      const blobShouldBeCopied = await shouldCopyBlob(blobItem, s3ObjectName);
      if (!blobShouldBeCopied) {
        return;
      }

      await copyBlobToS3(blobItem, s3ObjectName);
    };

    for await (const blobItem of blobItems) {
      await sema.acquire();

      migrateBlobToS3(blobItem).finally(() => sema.release());
    }

    await sema.drain();
  };
