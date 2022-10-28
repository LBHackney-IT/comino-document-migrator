import { BlobServiceClient as BlobClient } from "@azure/storage-blob";
import { S3Client } from "@aws-sdk/client-s3";
import { config } from "./config";
import {
  BlobListStream,
  BlobToS3CopyStream,
  createS3ObjectNameMapper,
} from "./storage";
import { ThrottledTransformStream } from "./throttle";

const blobClient = new BlobClient(config.azure.blob.url);
const blobListStream = new BlobListStream({
  blobClient,
  blobContainerName: config.azure.blob.containerName,
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
const s3ObjectNameMapper = createS3ObjectNameMapper({
  blobPrefix: config.azure.blob.prefix,
  s3Prefix: config.aws.s3.prefix,
});
const blobToS3CopyStream = new BlobToS3CopyStream({
  blobClient,
  blobContainerName: config.azure.blob.containerName,
  s3Client,
  s3BucketName: config.aws.s3.bucketName,
  s3ObjectNameMapper,
});
const throttledStream = new ThrottledTransformStream(blobToS3CopyStream, {
  objectMode: true,
  uniformDistribution: true,
});

blobListStream.pipe(throttledStream);
