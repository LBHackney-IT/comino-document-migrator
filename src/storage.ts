import {
  ContainerClient as BlobContainerClient,
  BlobItem,
} from "@azure/storage-blob";
import {
  S3Client,
  HeadObjectCommand,
  HeadObjectOutput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Logger } from "./log";

export interface BlobListIteratorConfig {
  blobContainerClient: BlobContainerClient;
  blobPrefix?: string;
  pageSize?: number;
}

export async function* createBlobList({
  blobContainerClient,
  blobPrefix,
  pageSize,
}: BlobListIteratorConfig): AsyncIterable<BlobItem> {
  const pages = blobContainerClient
    .listBlobsFlat({ prefix: blobPrefix })
    .byPage({ maxPageSize: pageSize });

  for await (const page of pages) {
    for (const item of page.segment.blobItems) {
      yield item;
    }
  }
}

export interface BlobToS3PredicateConfig {
  s3Client: S3Client;
  s3BucketName: string;
  logger: Logger;
}

export const createBlobToS3Predicate = ({
  s3Client,
  s3BucketName,
  logger,
}: BlobToS3PredicateConfig) => {
  return async (blobItem: BlobItem, s3ObjectName: string) => {
    let headObjectOutput: HeadObjectOutput | undefined;
    try {
      headObjectOutput = await s3Client.send(
        new HeadObjectCommand({
          Bucket: s3BucketName,
          Key: s3ObjectName,
        })
      );
    } catch (err) {
      if (err instanceof Error && err.name !== "NotFound") {
        throw err;
      }
    }

    if (blobItem.properties.contentLength === headObjectOutput?.ContentLength) {
      return false;
    }

    if (headObjectOutput?.ContentLength) {
      logger.info("Existing S3 object is being updated", {
        azureBlob: {
          name: blobItem.name,
          contentLength: blobItem.properties.contentLength,
        },
        s3Object: {
          name: s3ObjectName,
          contentLength: headObjectOutput.ContentLength,
        },
      });
    }

    return true;
  };
};

export interface BlobToS3CopyConfig {
  blobContainerClient: BlobContainerClient;
  s3Client: S3Client;
  s3BucketName: string;
}

export const createBlobToS3Copy = ({
  blobContainerClient,
  s3Client,
  s3BucketName,
}: BlobToS3CopyConfig) => {
  return async (blobItem: BlobItem, s3ObjectName: string) => {
    const blobItemClient = blobContainerClient.getBlobClient(blobItem.name);

    const blobDownloadResponse = await blobItemClient.download();

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: s3BucketName,
        Key: s3ObjectName,
        Body: blobDownloadResponse.readableStreamBody,
      },
    });

    await upload.done();
  };
};
