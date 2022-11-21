import { Readable } from "stream";
import { BlobServiceClient as BlobClient } from "@azure/storage-blob";
import { S3Client } from "@aws-sdk/client-s3";
import * as libStorage from "@aws-sdk/lib-storage";
import { partial } from "./helpers";
import {
  BlobListStream,
  BlobFilterStream,
  BlobToS3CopyStream,
} from "../src/storage";
import { Logger } from "../src/log";

jest.mock("@aws-sdk/lib-storage");
const mockLibStorage = jest.mocked(libStorage);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BlobListStream", () => {
  describe("_read", () => {
    test("successfully emits the blob items", (done) => {
      const containerName = "test";
      const pages = [["1.js", "2.js"], ["3.js", "4.js"], ["5.js"]].map((page) =>
        page.map((name) => ({ name }))
      );
      const results = [
        ...pages.map((page) => ({
          value: {
            segment: {
              blobItems: page,
            },
          },
        })),
        {
          done: true,
        },
      ];

      const expected = pages.reduce((acc, page) => [...acc, ...page], []);

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({
          listBlobsFlat: () => ({
            byPage: () => {
              let index = 0;
              return {
                next: () => {
                  return Promise.resolve(results[index++]);
                },
              };
            },
          }),
        }),
      });

      const stream = new BlobListStream({
        blobClient: mockBlobClient,
        blobContainerName: containerName,
      });

      let actual: string[] = [];
      stream
        .on("data", (result) => {
          actual = [...actual, result];
        })
        .on("end", () => {
          try {
            expect(actual).toEqual(expected);
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    test("successfully handles empty results", (done) => {
      const containerName = "test";
      const results = [
        {
          value: {
            segment: {
              blobItems: [],
            },
          },
        },
        {
          done: true,
        },
      ];

      const expected: string[] = [];

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({
          listBlobsFlat: () => ({
            byPage: () => {
              let index = 0;
              return {
                next: () => {
                  return Promise.resolve(results[index++]);
                },
              };
            },
          }),
        }),
      });

      const stream = new BlobListStream({
        blobClient: mockBlobClient,
        blobContainerName: containerName,
      });

      let actual: string[] = [];
      stream
        .on("data", (result) => {
          actual = [...actual, result];
        })
        .on("end", () => {
          try {
            expect(actual).toEqual(expected);
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    test("successfully emits an error on failure", (done) => {
      const containerName = "test";

      const errorMessage = "test error";
      const expected = new Error(errorMessage);

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({
          listBlobsFlat: () => ({
            byPage: () => ({
              next: () => {
                return Promise.reject(new Error(errorMessage));
              },
            }),
          }),
        }),
      });

      const stream = new BlobListStream({
        blobClient: mockBlobClient,
        blobContainerName: containerName,
      });

      stream
        .on("data", () => undefined)
        .on("error", (actual) => {
          try {
            expect(actual).toEqual(expected);
            done();
          } catch (err) {
            done(err);
          }
        });
    });
  });
});

describe("BlobFilterStream", () => {
  describe("_transform", () => {
    test("successfully emits a blob item for upload", (done) => {
      const blobName = "root/01/02/test.txt";
      const blobContentLength = 6;
      const blobItem = {
        name: blobName,
        properties: { contentLength: blobContentLength },
      };
      const s3BucketName = "s3-test";

      const error = new Error("Not found");
      error.name = "NotFound";

      const expected = [blobItem];

      const inputStream = new Readable({ objectMode: true });
      inputStream.push(blobItem);
      inputStream.push(null);

      const mockS3Client = partial<S3Client>({
        send: () => Promise.reject(error),
      });

      const mockS3ObjectNameMapper = (name: string) => name;

      const mockLogger = partial<Logger>({});

      const stream = new BlobFilterStream({
        s3Client: mockS3Client,
        s3BucketName,
        s3ObjectNameMapper: mockS3ObjectNameMapper,
        logger: mockLogger,
      });

      let actual: string[] = [];
      inputStream
        .pipe(stream)
        .on("data", (result) => {
          actual = [...actual, result];
        })
        .on("end", () => {
          try {
            expect(actual).toEqual(expected);
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    test("successfully emits a blob item for re-upload", (done) => {
      const blobName = "root/01/02/test.txt";
      const blobContentLength = 6;
      const blobItem = {
        name: blobName,
        properties: { contentLength: blobContentLength },
      };
      const s3BucketName = "s3-test";
      const s3ObjectContentLength = 12;

      const expected = [blobItem];

      const inputStream = new Readable({ objectMode: true });
      inputStream.push(blobItem);
      inputStream.push(null);

      const mockS3Client = partial<S3Client>({
        send: () =>
          Promise.resolve({
            ContentLength: s3ObjectContentLength,
          }),
      });

      const mockS3ObjectNameMapper = (name: string) => name;

      const mockLoggerInfo = jest.fn();
      const mockLogger = partial<Logger>({
        info: mockLoggerInfo,
      });

      const stream = new BlobFilterStream({
        s3Client: mockS3Client,
        s3BucketName,
        s3ObjectNameMapper: mockS3ObjectNameMapper,
        logger: mockLogger,
      });

      let actual: string[] = [];
      inputStream
        .pipe(stream)
        .on("data", (result) => {
          actual = [...actual, result];
        })
        .on("end", () => {
          try {
            expect(mockLoggerInfo).toBeCalled();
            expect(actual).toEqual(expected);
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    test("successfully ignores a blob item already uploaded", (done) => {
      const blobName = "root/01/02/test.txt";
      const blobContentLength = 6;
      const blobItem = {
        name: blobName,
        properties: { contentLength: blobContentLength },
      };
      const s3BucketName = "s3-test";
      const s3ObjectContentLength = 6;

      const expected: string[] = [];

      const inputStream = new Readable({ objectMode: true });
      inputStream.push(blobItem);
      inputStream.push(null);

      const mockS3Client = partial<S3Client>({
        send: () =>
          Promise.resolve({
            ContentLength: s3ObjectContentLength,
          }),
      });

      const mockS3ObjectNameMapper = (name: string) => name;

      const mockLogger = partial<Logger>({});

      const stream = new BlobFilterStream({
        s3Client: mockS3Client,
        s3BucketName,
        s3ObjectNameMapper: mockS3ObjectNameMapper,
        logger: mockLogger,
      });

      let actual: string[] = [];
      inputStream
        .pipe(stream)
        .on("data", (result) => {
          actual = [...actual, result];
        })
        .on("end", () => {
          try {
            expect(actual).toEqual(expected);
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    test("successfully emits an error on failure", (done) => {
      const blobName = "root/01/02/test.txt";
      const blobContentLength = 6;
      const blobItem = {
        name: blobName,
        properties: { contentLength: blobContentLength },
      };
      const s3BucketName = "s3-test";

      const errorMessage = "test error";
      const expected = new Error(errorMessage);

      const inputStream = new Readable({ objectMode: true });
      inputStream.push(blobItem);
      inputStream.push(null);

      const mockS3Client = partial<S3Client>({
        send: () => Promise.reject(new Error(errorMessage)),
      });

      const mockS3ObjectNameMapper = (name: string) => name;

      const mockLogger = partial<Logger>({});

      const stream = new BlobFilterStream({
        s3Client: mockS3Client,
        s3BucketName,
        s3ObjectNameMapper: mockS3ObjectNameMapper,
        logger: mockLogger,
      });

      inputStream
        .pipe(stream)
        .on("data", () => undefined)
        .on("error", (actual) => {
          try {
            expect(actual).toEqual(expected);
            done();
          } catch (err) {
            done(err);
          }
        });
    });
  });
});

describe("BlobToS3CopyStream", () => {
  describe("_transform", () => {
    test("successfully uploads a blob item", (done) => {
      const blobName = "root/01/02/test.txt";
      const blobBody = "test";
      const blobContainerName = "blob-test";
      const s3BucketName = "s3-test";

      const inputStream = new Readable({ objectMode: true });
      inputStream.push({
        name: blobName,
      });
      inputStream.push(null);

      const blobStream = new Readable();
      blobStream.push(blobBody);
      blobStream.push(null);

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({
          getBlobClient: () => ({
            download: () =>
              Promise.resolve({
                readableStreamBody: blobStream,
              }),
          }),
        }),
      });

      const mockS3Client = partial<S3Client>({});

      const mockS3ObjectNameMapper = (name: string) => name;

      const expected = {
        client: mockS3Client,
        params: {
          Bucket: s3BucketName,
          Key: blobName,
          Body: blobStream,
        },
      };

      const stream = new BlobToS3CopyStream({
        blobClient: mockBlobClient,
        blobContainerName,
        s3Client: mockS3Client,
        s3BucketName,
        s3ObjectNameMapper: mockS3ObjectNameMapper,
      });

      inputStream
        .pipe(stream)
        .on("data", () => undefined)
        .on("end", () => {
          try {
            expect(mockLibStorage.Upload).toBeCalledWith(expected);
            expect(mockLibStorage.Upload.mock.instances[0].done).toBeCalled();
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    test("successfully emits an error on failure", (done) => {
      const blobName = "root/01/02/test.txt";
      const blobContainerName = "blob-test";
      const s3BucketName = "s3-test";

      const errorMessage = "test error";
      const expected = new Error(errorMessage);

      const inputStream = new Readable({ objectMode: true });
      inputStream.push({ name: blobName });
      inputStream.push(null);

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({
          getBlobClient: () => ({
            download: () => Promise.reject(new Error(errorMessage)),
          }),
        }),
      });

      const mockS3Client = partial<S3Client>({});

      const mockS3ObjectNameMapper = (name: string) => name;

      const stream = new BlobToS3CopyStream({
        blobClient: mockBlobClient,
        blobContainerName,
        s3Client: mockS3Client,
        s3BucketName,
        s3ObjectNameMapper: mockS3ObjectNameMapper,
        maxRetries: 0,
      });

      inputStream
        .pipe(stream)
        .on("data", () => undefined)
        .on("error", (actual) => {
          try {
            expect(actual).toEqual(expected);
            done();
          } catch (err) {
            done(err);
          }
        });
    });
  });
});
