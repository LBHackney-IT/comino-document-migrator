import { BlobServiceClient as BlobClient } from "@azure/storage-blob";
import { S3Client } from "@aws-sdk/client-s3";
import { config } from "./config";
import { BlobListStream, BlobToS3CopyStream } from "./storage";
import { ThrottledTransformStream } from "./throttle";

const blobClient = new BlobClient(config.azure.blob.url);
const blobListStream = new BlobListStream({
  blobClient,
  blobContainerName: config.azure.blob.containerName,
  pageSize: 3,
});
const s3Client = new S3Client({
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
    sessionToken: config.aws.sessionToken,
  },
  region: config.aws.region,
});
const blobToS3CopyStream = new BlobToS3CopyStream({
  blobClient,
  blobContainerName: config.azure.blob.containerName,
  s3Client,
  s3BucketName: config.aws.s3.bucketName,
});
const throttledStream = new ThrottledTransformStream(blobToS3CopyStream, {
  objectMode: true,
  uniformDistribution: true,
});

blobListStream.pipe(throttledStream).on("data", (result) => {
  console.log(JSON.stringify(result));
});
