import { BlobServiceClient as BlobClient } from "@azure/storage-blob";
import { S3Client } from "@aws-sdk/client-s3";
import * as libStorage from "@aws-sdk/lib-storage";
import { partial } from "./helpers";
import { BlobContainer, BlobMetadata, S3Bucket } from "../src/storage";
import { Logger } from "../src/log";

jest.mock("@aws-sdk/lib-storage");
const mockLibStorage = jest.mocked(libStorage);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BlobContainer", () => {
  describe("listBlobs", () => {
    test("successfully lists blobs", async () => {
      const containerName = "test";
      const pageSize = 2;
      const pages = [
        [
          { name: "1.txt", properties: { contentLength: 1 } },
          { name: "2.txt", properties: { contentLength: 3 } },
        ],
        [
          { name: "3.txt", properties: { contentLength: 4 } },
          { name: "4.txt", properties: { contentLength: 2 } },
        ],
        [{ name: "4.txt", properties: { contentLength: 3 } }],
      ];

      const expected = pages.reduce(
        (acc, page) => [
          ...acc,
          ...page.map((item) => ({
            name: item.name,
            contentLength: item.properties.contentLength,
          })),
        ],
        [] as BlobMetadata[]
      );

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({
          listBlobsFlat: () => ({
            byPage: async function* () {
              for (const page of pages) {
                yield { segment: { blobItems: page } };
              }
            },
          }),
        }),
      });

      const blobContainer = new BlobContainer({
        blobClient: mockBlobClient,
        name: containerName,
        pageSize,
      });
      const blobMetadataList = blobContainer.listBlobs();

      let actual: BlobMetadata[] = [];
      for await (const blobMetadata of blobMetadataList) {
        actual = [...actual, blobMetadata];
      }

      expect(actual).toEqual(expected);
    });
  });

  describe("getBlobContent", () => {
    test("successfully gets the blob content", async () => {
      const containerName = "test";
      const blobName = "test.txt";
      const blobContentType = "text/plain";
      const blobBody = "test";
      const blobStream = partial<ReadableStream>({
        getReader: () => ({
          read: () =>
            Promise.resolve({ value: Buffer.from(blobBody), done: true }),
        }),
      });

      const expected = {
        body: blobStream,
        contentType: blobContentType,
      };

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({
          getBlobClient: () => ({
            download: () =>
              Promise.resolve({
                readableStreamBody: blobStream,
                contentType: blobContentType,
              }),
          }),
        }),
      });

      const blobContainer = new BlobContainer({
        blobClient: mockBlobClient,
        name: containerName,
      });
      const actual = await blobContainer.getBlobContent(blobName);

      expect(actual).toEqual(expected);
    });
  });
});

describe("S3Bucket", () => {
  describe("doesObjectExist", () => {
    test("successfully identifies an existing object", async () => {
      const bucketName = "test";
      const blobName = "test.txt";
      const blobContentLength = 6;
      const objectContentLength = 6;

      const expected = true;

      const mockS3Client = partial<S3Client>({
        send: () =>
          Promise.resolve({
            ContentLength: objectContentLength,
          }),
      });

      const mockLogger = partial<Logger>({});

      const s3Bucket = new S3Bucket({
        s3Client: mockS3Client,
        name: bucketName,
        logger: mockLogger,
      });
      const actual = await s3Bucket.doesObjectExist(
        blobName,
        blobContentLength
      );

      expect(actual).toEqual(expected);
    });

    test("successfully identifies an object with a duplicate name", async () => {
      const bucketName = "test";
      const blobName = "test.txt";
      const blobContentLength = 6;
      const objectContentLength = 7;

      const expected = false;

      const mockS3Client = partial<S3Client>({
        send: () =>
          Promise.resolve({
            ContentLength: objectContentLength,
          }),
      });

      const mockLoggerInfo = jest.fn();
      const mockLogger = partial<Logger>({
        info: mockLoggerInfo,
      });

      const s3Bucket = new S3Bucket({
        s3Client: mockS3Client,
        name: bucketName,
        logger: mockLogger,
      });
      const actual = await s3Bucket.doesObjectExist(
        blobName,
        blobContentLength
      );

      expect(actual).toEqual(expected);
      expect(mockLoggerInfo).toBeCalled();
    });

    test("successfully identfies a new object", async () => {
      const bucketName = "test";
      const blobName = "test.txt";
      const blobContentLength = 6;
      const error = new Error("Not found");
      error.name = "NotFound";

      const expected = false;

      const mockS3Client = partial<S3Client>({
        send: () => Promise.reject(error),
      });

      const mockLogger = partial<Logger>({});

      const s3Bucket = new S3Bucket({
        s3Client: mockS3Client,
        name: bucketName,
        logger: mockLogger,
      });
      const actual = await s3Bucket.doesObjectExist(
        blobName,
        blobContentLength
      );

      expect(actual).toEqual(expected);
    });

    test("successfully throws on failure", async () => {
      const bucketName = "test";
      const blobName = "test.txt";
      const blobContentLength = 6;
      const error = new Error("Test Error");

      const expected = error;

      const mockS3Client = partial<S3Client>({
        send: () => Promise.reject(error),
      });

      const mockLogger = partial<Logger>({});

      const s3Bucket = new S3Bucket({
        s3Client: mockS3Client,
        name: bucketName,
        logger: mockLogger,
      });

      await expect(
        s3Bucket.doesObjectExist(blobName, blobContentLength)
      ).rejects.toThrowError(expected);
    });
  });

  describe("putObjectStream", () => {
    test("successfully uploads an object", async () => {
      const bucketName = "test";
      const objectName = "test.txt";
      const blobContentType = "text/plain";
      const blobBody = "test";
      const blobStream = partial<ReadableStream>({
        getReader: () => ({
          read: () =>
            Promise.resolve({ value: Buffer.from(blobBody), done: true }),
        }),
      });

      const mockS3Client = partial<S3Client>({});

      const expected = {
        client: mockS3Client,
        params: {
          Bucket: bucketName,
          Key: objectName,
          ContentType: blobContentType,
          Body: blobStream,
        },
      };

      const mockLogger = partial<Logger>({});

      const s3Bucket = new S3Bucket({
        s3Client: mockS3Client,
        name: bucketName,
        logger: mockLogger,
      });
      await s3Bucket.putObjectStream(objectName, blobContentType, blobStream);

      expect(mockLibStorage.Upload).toBeCalledWith(expected);
      expect(mockLibStorage.Upload.mock.instances[0].done).toBeCalled();
    });
  });
});
