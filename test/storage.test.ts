import { BlobServiceClient as BlobClient } from "@azure/storage-blob";
import { S3Client } from "@aws-sdk/client-s3";
import * as libStorage from "@aws-sdk/lib-storage";
import { partial } from "./helpers";
import { BlobContainer, S3Bucket } from "../src/storage";
import { DocumentMetadata } from "../src/migration";
import { Logger } from "../src/log";

jest.mock("@aws-sdk/lib-storage");
const mockLibStorage = jest.mocked(libStorage);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BlobContainer", () => {
  describe("listDocuments", () => {
    test("successfully lists documents", async () => {
      const containerName = "test";
      const pageSize = 2;
      const checkpointPageInterval = 2;
      const pages = [
        [
          { name: "1.txt", properties: { contentLength: 1 } },
          { name: "2.txt", properties: { contentLength: 3 } },
        ],
        [
          { name: "3.txt", properties: { contentLength: 4 } },
          { name: "4.txt", properties: { contentLength: 2 } },
        ],
        [{ name: "5.txt", properties: { contentLength: 3 } }],
      ];

      const expected = pages.reduce(
        (acc, page) => [
          ...acc,
          ...page.map((item) => ({
            name: item.name,
            contentLength: item.properties.contentLength,
          })),
        ],
        [] as DocumentMetadata[]
      );

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({
          listBlobsFlat: () => ({
            byPage: async function* () {
              for (const [idx, page] of pages.entries()) {
                yield {
                  segment: { blobItems: page },
                  continuationToken: `test-${idx}`,
                };
              }
            },
          }),
        }),
      });

      const mockLoggerInfo = jest.fn();
      const mockLogger = partial<Logger>({
        info: mockLoggerInfo,
      });

      const blobContainer = new BlobContainer({
        blobClient: mockBlobClient,
        name: containerName,
        pageSize,
        checkpointPageInterval,
        logger: mockLogger,
      });
      const documentMetadataList = blobContainer.listDocuments();

      let actual: DocumentMetadata[] = [];
      for await (const documentMetadata of documentMetadataList) {
        actual = [...actual, documentMetadata];
      }

      expect(actual).toEqual(expected);
      expect(mockLoggerInfo).toBeCalledTimes(1);
    });
  });

  describe("getDocumentContent", () => {
    test("successfully gets the document content", async () => {
      const containerName = "test";
      const documentName = "test.txt";
      const documentContentType = "text/plain";
      const documentStream = partial<ReadableStream>({});

      const expected = {
        body: documentStream,
        contentType: documentContentType,
      };

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({
          getBlobClient: () => ({
            download: () =>
              Promise.resolve({
                readableStreamBody: documentStream,
                contentType: documentContentType,
              }),
          }),
        }),
      });

      const mockLogger = partial<Logger>({});

      const blobContainer = new BlobContainer({
        blobClient: mockBlobClient,
        name: containerName,
        logger: mockLogger,
      });
      const actual = await blobContainer.getDocumentContent(documentName);

      expect(actual).toEqual(expected);
    });
  });
});

describe("S3Bucket", () => {
  describe("doesDocumentExist", () => {
    test("successfully identifies an existing document", async () => {
      const bucketName = "test";
      const documentName = "test.txt";
      const newDocumentContentLength = 6;
      const existingDocumentContentLength = 6;

      const expected = true;

      const mockS3Client = partial<S3Client>({
        send: () =>
          Promise.resolve({
            ContentLength: existingDocumentContentLength,
          }),
      });

      const mockLogger = partial<Logger>({});

      const s3Bucket = new S3Bucket({
        s3Client: mockS3Client,
        name: bucketName,
        logger: mockLogger,
      });
      const actual = await s3Bucket.doesDocumentExist(
        documentName,
        newDocumentContentLength
      );

      expect(actual).toEqual(expected);
    });

    test("successfully identifies a document with a duplicate name", async () => {
      const bucketName = "test";
      const documentName = "test.txt";
      const newDocumentContentLength = 6;
      const existingDocumentContentLength = 7;

      const expected = false;

      const mockS3Client = partial<S3Client>({
        send: () =>
          Promise.resolve({
            ContentLength: existingDocumentContentLength,
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
      const actual = await s3Bucket.doesDocumentExist(
        documentName,
        newDocumentContentLength
      );

      expect(actual).toEqual(expected);
      expect(mockLoggerInfo).toBeCalled();
    });

    test("successfully identfies a new document", async () => {
      const bucketName = "test";
      const documentName = "test.txt";
      const documentContentLength = 6;
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
      const actual = await s3Bucket.doesDocumentExist(
        documentName,
        documentContentLength
      );

      expect(actual).toEqual(expected);
    });

    test("successfully handles a failure", async () => {
      const bucketName = "test";
      const documentName = "test.txt";
      const documentContentLength = 6;
      const error = new Error("Test Error");

      const expected = false;

      const mockS3Client = partial<S3Client>({
        send: () => Promise.reject(error),
      });

      const mockLoggerError = jest.fn();
      const mockLogger = partial<Logger>({
        error: mockLoggerError,
      });

      const s3Bucket = new S3Bucket({
        s3Client: mockS3Client,
        name: bucketName,
        logger: mockLogger,
      });
      const actual = await s3Bucket.doesDocumentExist(
        documentName,
        documentContentLength
      );

      expect(actual).toEqual(expected);
      expect(mockLoggerError).toBeCalled();
    });
  });

  describe("putDocumentContent", () => {
    test("successfully uploads a document", async () => {
      const bucketName = "test";
      const documentName = "test.txt";
      const documentContentType = "text/plain";
      const documentStream = partial<ReadableStream>({});

      const mockS3Client = partial<S3Client>({});

      const expected = {
        client: mockS3Client,
        params: {
          Bucket: bucketName,
          Key: documentName,
          ContentType: documentContentType,
          Body: documentStream,
        },
      };

      const mockLogger = partial<Logger>({});

      const s3Bucket = new S3Bucket({
        s3Client: mockS3Client,
        name: bucketName,
        logger: mockLogger,
      });
      await s3Bucket.putDocumentContent(
        documentName,
        documentContentType,
        documentStream
      );

      expect(mockLibStorage.Upload).toBeCalledWith(expected);
      expect(mockLibStorage.Upload.mock.instances[0].done).toBeCalled();
    });
  });
});
