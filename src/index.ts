import { BlobServiceClient as BlobClient } from "@azure/storage-blob";
import { S3Client } from "@aws-sdk/client-s3";
import { config } from "./config";
import { createLogger } from "./log";
import {
  createBlobList,
  createBlobToS3Predicate,
  createBlobToS3Copy,
} from "./storage";
import { createDocumentNameMapper } from "./document";
import { createBlobToS3Migration } from "./migration";

const logger = createLogger(config.service, config.log.level);
const blobUrl = `${config.azure.blob.url}?${config.azure.blob.sasToken}`;
const blobClient = new BlobClient(blobUrl);
const blobContainerClient = blobClient.getContainerClient(
  config.azure.blob.containerName
);
const s3Client = new S3Client({
  region: config.aws.region,
});
const blobItems = createBlobList({
  blobContainerClient,
  blobPrefix: config.azure.blob.prefix,
  pageSize: config.azure.blob.pageSize,
});
const mapDocumentName = createDocumentNameMapper(config.aws.s3.prefix);
const shouldCopyBlob = createBlobToS3Predicate({
  s3Client,
  s3BucketName: config.aws.s3.bucketName,
  logger,
});
const copyBlobToS3 = createBlobToS3Copy({
  blobContainerClient,
  s3Client,
  s3BucketName: config.aws.s3.bucketName,
});
const runMigrationTask = createBlobToS3Migration({
  s3ObjectNameMap: mapDocumentName,
  blobToS3Predicate: shouldCopyBlob,
  blobToS3Copy: copyBlobToS3,
  maxConcurrency: config.migration.maxConcurrentDocuments,
});

runMigrationTask(blobItems)
  .then(() => logger.info("Migration finished"))
  .catch((err) => logger.error(err));
