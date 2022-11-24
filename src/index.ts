import path from "path";
import { BlobServiceClient as BlobClient } from "@azure/storage-blob";
import { S3Client } from "@aws-sdk/client-s3";
import { config } from "./config";
import { createLogger } from "./log";
import { BlobContainer, S3Bucket } from "./storage";
import { createMigration } from "./migration";

const logger = createLogger(config.service, config.log.level);
const blobUrl = `${config.azure.blob.url}?${config.azure.blob.sasToken}`;
const blobClient = new BlobClient(blobUrl);
const s3Client = new S3Client({
  region: config.aws.region,
});
const blobContainer = new BlobContainer({
  blobClient,
  name: config.azure.blob.containerName,
  prefix: config.azure.blob.prefix,
  pageSize: config.azure.blob.pageSize,
});
const s3Bucket = new S3Bucket({
  s3Client,
  name: config.aws.s3.bucketName,
  prefix: config.aws.s3.prefix,
  logger,
});
const runMigration = createMigration({
  blobContainer,
  s3Bucket,
  s3ObjectNameMapper: path.basename,
  maxConcurrentDocuments: config.migration.maxConcurrentDocuments,
  maxRetriesPerDocument: config.migration.maxRetriesPerDocument,
});

runMigration()
  .then(() => logger.info("Migration finished"))
  .catch((err) => logger.error(err));
