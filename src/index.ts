import { pipeline } from "stream";
import { BlobServiceClient as BlobClient } from "@azure/storage-blob";
import { S3Client } from "@aws-sdk/client-s3";
import { config } from "./config";
import { createLogger } from "./log";
import {
  BlobListStream,
  BlobFilterStream,
  BlobToS3CopyStream,
} from "./storage";
import { createDocumentNameMapper } from "./document";
import { ThrottledTransformStream } from "./throttle";

const logger = createLogger(config.service, config.log.level);
const blobUrl = `${config.azure.blob.url}?${config.azure.blob.sasToken}`;
const blobClient = new BlobClient(blobUrl);
const blobListStream = new BlobListStream({
  blobClient,
  blobContainerName: config.azure.blob.containerName,
  blobPrefix: config.azure.blob.prefix,
  pageSize: config.azure.blob.pageSize,
});
const s3Client = new S3Client({
  region: config.aws.region,
});
const s3ObjectNameMapper = createDocumentNameMapper(config.aws.s3.prefix);
const blobFilterStream = new BlobFilterStream({
  s3Client,
  s3BucketName: config.aws.s3.bucketName,
  s3ObjectNameMapper,
  logger,
});
const throttledFilterStream = new ThrottledTransformStream(blobFilterStream, {
  objectMode: true,
  maxConcurrency: config.migration.maxConcurrentDocuments,
});
const blobToS3CopyStream = new BlobToS3CopyStream({
  blobClient,
  blobContainerName: config.azure.blob.containerName,
  s3Client,
  s3BucketName: config.aws.s3.bucketName,
  s3ObjectNameMapper,
  maxRetries: config.migration.maxRetriesPerDocument,
});
const throttledCopyStream = new ThrottledTransformStream(blobToS3CopyStream, {
  objectMode: true,
  maxConcurrency: config.migration.maxConcurrentDocuments,
});

pipeline(blobListStream, throttledFilterStream, throttledCopyStream, (err) => {
  if (err) {
    logger.error(err);
  }
});
