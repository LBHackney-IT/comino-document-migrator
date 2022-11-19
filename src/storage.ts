import { Readable, Transform, TransformCallback } from "stream";
import {
  BlobServiceClient as BlobClient,
  BlobItem,
  ContainerListBlobFlatSegmentResponse,
  ContainerClient,
} from "@azure/storage-blob";
import {
  S3Client,
  HeadObjectCommand,
  HeadObjectOutput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import retry from "async-retry";
import { Logger } from "./log";

export interface BlobListStreamConfig {
  blobClient: BlobClient;
  blobContainerName: string;
  blobPrefix?: string;
  pageSize?: number;
}

export class BlobListStream extends Readable {
  private iterator: AsyncIterableIterator<ContainerListBlobFlatSegmentResponse>;
  private queue: BlobItem[] = [];

  constructor({
    blobClient,
    blobContainerName,
    blobPrefix,
    pageSize,
  }: BlobListStreamConfig) {
    super({ objectMode: true });

    const containerClient = blobClient.getContainerClient(blobContainerName);
    this.iterator = containerClient
      .listBlobsFlat({ prefix: blobPrefix })
      .byPage({ maxPageSize: pageSize ?? 100 });
  }

  _read() {
    if (this.queue.length > 0) {
      const item = this.queue.shift();
      this.push(item);

      return;
    }

    this.iterator
      .next()
      .then((res) => {
        if (res.done || res.value.segment.blobItems.length === 0) {
          this.push(null);

          return;
        }

        this.queue = res.value.segment.blobItems;

        const item = this.queue.shift();
        this.push(item);
      })
      .catch((err) => this.emit("error", err));
  }
}

export interface ObjectNameMapper {
  (name: string): string;
}

export interface BlobFilterStreamConfig {
  s3Client: S3Client;
  s3BucketName: string;
  s3ObjectNameMapper: ObjectNameMapper;
  logger: Logger;
}

export class BlobFilterStream extends Transform {
  private s3Client: S3Client;
  private s3BucketName: string;
  private mapS3ObjectName: ObjectNameMapper;
  private logger: Logger;

  constructor({
    s3Client,
    s3BucketName,
    s3ObjectNameMapper,
    logger,
  }: BlobFilterStreamConfig) {
    super({ objectMode: true });

    this.s3Client = s3Client;
    this.s3BucketName = s3BucketName;
    this.mapS3ObjectName = s3ObjectNameMapper;
    this.logger = logger;
  }

  _transform(
    blobItem: BlobItem,
    _encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const s3ObjectName = this.mapS3ObjectName(blobItem.name);

    this.filterBlob(blobItem, s3ObjectName)
      .then((res) => callback(null, res))
      .catch((err) => callback(err));
  }

  private async filterBlob(
    blobItem: BlobItem,
    s3ObjectName: string
  ): Promise<BlobItem | undefined> {
    let headObjectOutput: HeadObjectOutput | undefined;
    try {
      headObjectOutput = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.s3BucketName,
          Key: s3ObjectName,
        })
      );
    } catch (err) {
      if (err instanceof Error && err.name !== "NotFound") {
        throw err;
      }
    }

    if (blobItem.properties.contentLength === headObjectOutput?.ContentLength) {
      return;
    }

    if (headObjectOutput?.ContentLength) {
      this.logger.info("Existing S3 object is being updated", {
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

    return blobItem;
  }
}

export interface BlobToS3CopyStreamConfig {
  blobClient: BlobClient;
  blobContainerName: string;
  s3Client: S3Client;
  s3BucketName: string;
  s3ObjectNameMapper: ObjectNameMapper;
  maxRetries?: number;
}

export class BlobToS3CopyStream extends Transform {
  private containerClient: ContainerClient;
  private s3Client: S3Client;
  private s3BucketName: string;
  private mapS3ObjectName: ObjectNameMapper;
  private maxRetries?: number;

  constructor({
    blobClient,
    blobContainerName,
    s3Client,
    s3BucketName,
    s3ObjectNameMapper,
    maxRetries,
  }: BlobToS3CopyStreamConfig) {
    super({ objectMode: true });

    this.containerClient = blobClient.getContainerClient(blobContainerName);
    this.s3Client = s3Client;
    this.s3BucketName = s3BucketName;
    this.mapS3ObjectName = s3ObjectNameMapper;
    this.maxRetries = maxRetries;
  }

  _transform(
    blobItem: BlobItem,
    _encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const s3ObjectName = this.mapS3ObjectName(blobItem.name);

    this.copyBlobToS3(blobItem, s3ObjectName)
      .then(() => callback(null))
      .catch((err) => callback(err));
  }

  private async copyBlobToS3(
    blobItem: BlobItem,
    s3ObjectName: string
  ): Promise<void> {
    await retry(
      async () => {
        const blobItemClient = this.containerClient.getBlobClient(
          blobItem.name
        );
        const blobDownloadResponse = await blobItemClient.download();

        const upload = new Upload({
          client: this.s3Client,
          params: {
            Bucket: this.s3BucketName,
            Key: s3ObjectName,
            Body: blobDownloadResponse.readableStreamBody,
          },
        });

        await upload.done();
      },
      { retries: this.maxRetries }
    );
  }
}
