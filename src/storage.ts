import path from "path";
import {
  BlobServiceClient as BlobClient,
  ContainerClient,
} from "@azure/storage-blob";
import {
  S3Client,
  HeadObjectCommand,
  HeadObjectOutput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Logger } from "./log";

export interface BlobMetadata {
  name: string;
  contentLength?: number;
}

export interface BlobContent {
  body?: ReadableStream;
  contentType?: string;
}

export interface BlobContainerConfig {
  blobClient: BlobClient;
  name: string;
  prefix?: string;
  pageSize?: number;
}

export class BlobContainer {
  private client: ContainerClient;
  private prefix: string;
  private pageSize: number;

  constructor({ blobClient, name, prefix, pageSize }: BlobContainerConfig) {
    this.client = blobClient.getContainerClient(name);
    this.prefix = prefix ?? "";
    this.pageSize = pageSize ?? 100;
  }

  async *listBlobs(): AsyncIterable<BlobMetadata> {
    const pages = this.client
      .listBlobsFlat({ prefix: this.prefix })
      .byPage({ maxPageSize: this.pageSize });

    for await (const page of pages) {
      for (const item of page.segment.blobItems) {
        yield { name: item.name, contentLength: item.properties.contentLength };
      }
    }
  }

  async getBlobContent(name: string): Promise<BlobContent> {
    const blobItemClient = this.client.getBlobClient(name);
    const blobDownloadResponse = await blobItemClient.download();

    return {
      body: blobDownloadResponse.readableStreamBody,
      contentType: blobDownloadResponse.contentType,
    };
  }
}

export interface S3BucketConfig {
  s3Client: S3Client;
  name: string;
  prefix?: string;
  logger: Logger;
}

export class S3Bucket {
  private client: S3Client;
  private name: string;
  private prefix: string;
  private logger: Logger;

  constructor({ s3Client, name, prefix, logger }: S3BucketConfig) {
    this.client = s3Client;
    this.name = name;
    this.prefix = prefix ?? "";
    this.logger = logger;
  }

  async doesObjectExist(
    name: string,
    contentLength?: number
  ): Promise<boolean> {
    const mappedName = this.mapObjectName(name);

    let headObjectOutput: HeadObjectOutput | undefined;
    try {
      headObjectOutput = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.name,
          Key: this.mapObjectName(name),
        })
      );
    } catch (err) {
      if (err instanceof Error && err.name !== "NotFound") {
        throw err;
      }

      return false;
    }

    if (contentLength !== headObjectOutput.ContentLength) {
      this.logger.info("Duplicate object name", {
        objectName: mappedName,
      });

      return false;
    }

    return true;
  }

  async putObjectStream(
    name: string,
    contentType?: string,
    stream?: ReadableStream
  ): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.name,
        Key: this.mapObjectName(name),
        ContentType: contentType,
        Body: stream,
      },
    });

    await upload.done();
  }

  private mapObjectName(name: string): string {
    return path.join(this.prefix, name);
  }
}
