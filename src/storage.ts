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
import {
  DocumentSource,
  DocumentDestination,
  DocumentMetadata,
  DocumentContent,
} from "./migration";

export interface BlobContainerConfig {
  blobClient: BlobClient;
  name: string;
  prefix?: string;
  pageSize?: number;
  checkpointPageInterval?: number;
  checkpointToken?: string;
  logger: Logger;
}

export class BlobContainer implements DocumentSource {
  private client: ContainerClient;
  private prefix: string;
  private pageSize: number;
  private checkpointPageInterval: number;
  private checkpointToken?: string;
  private logger: Logger;

  constructor({
    blobClient,
    name,
    prefix = "",
    pageSize = 100,
    checkpointPageInterval = 1000,
    checkpointToken,
    logger,
  }: BlobContainerConfig) {
    this.client = blobClient.getContainerClient(name);
    this.prefix = prefix;
    this.pageSize = pageSize;
    this.checkpointPageInterval = checkpointPageInterval;
    this.checkpointToken = checkpointToken;
    this.logger = logger;
  }

  async *listDocuments(): AsyncIterable<DocumentMetadata> {
    const pages = this.client.listBlobsFlat({ prefix: this.prefix }).byPage({
      maxPageSize: this.pageSize,
      continuationToken: this.checkpointToken,
    });
    let pageCount = 0;
    let documentCount = 0;

    for await (const page of pages) {
      for (const item of page.segment.blobItems) {
        documentCount++;

        yield {
          name: item.name.substring(this.prefix.length),
          contentLength: item.properties.contentLength,
        };
      }

      if (
        ++pageCount % this.checkpointPageInterval === 0 &&
        page.continuationToken
      ) {
        this.logger.info("Checkpoint reached", {
          pageCount: pageCount,
          documentCount: documentCount,
          continuationToken: page.continuationToken,
        });
      }
    }
  }

  async getDocumentContent(name: string): Promise<DocumentContent> {
    const fullName = `${this.prefix}${name}`;

    const blobItemClient = this.client.getBlobClient(fullName);
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

export class S3Bucket implements DocumentDestination {
  private client: S3Client;
  private name: string;
  private prefix: string;
  private logger: Logger;

  constructor({ s3Client, name, prefix = "", logger }: S3BucketConfig) {
    this.client = s3Client;
    this.name = name;
    this.prefix = prefix;
    this.logger = logger;
  }

  async doesDocumentExist(
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
        this.logger.error(err, {
          objectName: mappedName,
        });
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

  async putDocumentContent(
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
    return `${this.prefix}${name}`;
  }
}
