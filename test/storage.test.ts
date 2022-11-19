import { Readable } from "stream";
import { BlobServiceClient as BlobClient } from "@azure/storage-blob";
import { S3Client } from "@aws-sdk/client-s3";
import * as libStorage from "@aws-sdk/lib-storage";
import { partial } from "./helpers";
import { BlobListStream, BlobToS3CopyStream } from "../src/storage";
import { Logger } from "../src/log";

jest.mock("@aws-sdk/lib-storage");
const mockLibStorage = jest.mocked(libStorage);

const mockLogger = partial<Logger>({
  info: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BlobListStream", () => {
  describe("_read", () => {
    test("successfully emits the objects in storage", (done) => {
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

describe("BlobToS3CopyStream", () => {
  describe("_transform", () => {
    test("successfully uploads an object to S3", (done) => {
      const blobName = "root/01/02/test.txt";
      const blobBody = "test";
      const blobContainerName = "blob-test";
      const s3BucketName = "s3-test";

      const error = new Error("Not found");
      error.name = "NotFound";

      const inputStream = new Readable({ objectMode: true });
      inputStream.push({
        name: blobName,
        properties: { contentLength: blobBody.length },
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

      const mockS3Client = partial<S3Client>({
        send: () => Promise.reject(error),
      });

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
        logger: mockLogger,
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

    test("successfully re-uploads an object to S3 when the content has changed", (done) => {
      const blobName = "root/01/02/test.txt";
      const blobBody = "test";
      const blobContainerName = "blob-test";
      const s3BucketName = "s3-test";

      const inputStream = new Readable({ objectMode: true });
      inputStream.push({
        name: blobName,
        properties: { contentLength: blobBody.length },
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

      const mockS3Client = partial<S3Client>({
        send: () => Promise.resolve(),
      });

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
        logger: mockLogger,
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

    test("successfully ignores objects that are already uploaded to S3", (done) => {
      const blobName = "root/01/02/test.txt";
      const blobBody = "test";
      const blobContainerName = "blob-test";
      const s3BucketName = "s3-test";

      const inputStream = new Readable({ objectMode: true });
      inputStream.push({
        name: blobName,
        properties: { contentLength: blobBody.length },
      });
      inputStream.push(null);

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({}),
      });

      const mockS3Client = partial<S3Client>({
        send: () =>
          Promise.resolve({
            ContentLength: blobBody.length,
          }),
      });

      const stream = new BlobToS3CopyStream({
        blobClient: mockBlobClient,
        blobContainerName,
        s3Client: mockS3Client,
        s3BucketName,
        logger: mockLogger,
      });

      inputStream
        .pipe(stream)
        .on("data", () => undefined)
        .on("end", () => {
          try {
            expect(mockLibStorage.Upload).not.toBeCalled();
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
        getContainerClient: () => ({}),
      });

      const mockS3Client = partial<S3Client>({
        send: () => Promise.reject(new Error(errorMessage)),
      });

      const stream = new BlobToS3CopyStream({
        blobClient: mockBlobClient,
        blobContainerName,
        s3Client: mockS3Client,
        s3BucketName,
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
