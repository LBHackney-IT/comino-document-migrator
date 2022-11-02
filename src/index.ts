import { BlobServiceClient as BlobClient } from "@azure/storage-blob";
import { S3Client } from "@aws-sdk/client-s3";
import { config } from "./config";
import { BlobListStream, BlobToS3CopyStream } from "./storage";
import { createDocumentNameMapper } from "./document";
import { ThrottledTransformStream } from "./throttle";

const blobClient = new BlobClient(config.azure.blob.url);
const blobListStream = new BlobListStream({
  blobClient,
  blobContainerName: config.azure.blob.containerName,
  blobPrefix: config.azure.blob.prefix,
  pageSize: config.azure.blob.pageSize,
});
const s3Client = new S3Client({
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
    sessionToken: config.aws.sessionToken,
  },
  region: config.aws.region,
});
const s3ObjectNameMapper = createDocumentNameMapper(config.aws.s3.prefix);
const blobToS3CopyStream = new BlobToS3CopyStream({
  blobClient,
  blobContainerName: config.azure.blob.containerName,
  s3Client,
  s3BucketName: config.aws.s3.bucketName,
  s3ObjectNameMapper,
  maxRetries: config.migration.maxRetriesPerDocument,
});
const throttledStream = new ThrottledTransformStream(blobToS3CopyStream, {
  objectMode: true,
  queriesPerSecond: config.migration.maxDocumentsPerSecond,
  uniformDistribution: true,
});

blobListStream.pipe(throttledStream);
