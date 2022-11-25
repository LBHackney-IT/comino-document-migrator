import { partial } from "./helpers";
import { BlobContainer, S3Bucket } from "../src/storage";
import { createMigration } from "../src/migration";

describe("createMigration", () => {
  test("successfully creates a migration that only copies new files", async () => {
    const blobs = [
      {
        name: "1.txt",
        contentLength: 1,
        contentType: "text/plain",
        exists: false,
      },
      {
        name: "2.txt",
        contentLength: 2,
        contentType: "text/plain",
        exists: false,
      },
      {
        name: "3.txt",
        contentLength: 5,
        contentType: "text/plain",
        exists: true,
      },
      {
        name: "4.txt",
        contentLength: 4,
        contentType: "text/plain",
        exists: false,
      },
      {
        name: "5.txt",
        contentLength: 3,
        contentType: "text/plain",
        exists: true,
      },
    ];

    const expected = blobs
      .filter((blob) => !blob.exists)
      .map(({ name, contentType }) => [
        name,
        contentType,
        partial<ReadableStream>({}),
      ]);

    const mockBlobContainerGetBlobContent = jest.fn();
    blobs.forEach(({ contentType }) =>
      mockBlobContainerGetBlobContent.mockResolvedValueOnce({
        contentType,
        body: partial<ReadableStream>({}),
      })
    );
    const mockBlobContainer = partial<BlobContainer>({
      listBlobs: async function* () {
        for (const { name, contentLength } of blobs) {
          yield { name, contentLength };
        }
      },
      getBlobContent: mockBlobContainerGetBlobContent,
    });

    const mockS3BucketDoesObjectExist = jest.fn();
    blobs.forEach((blob) =>
      mockS3BucketDoesObjectExist.mockResolvedValueOnce(blob.exists)
    );
    const mockS3BucketPutObjectStream = jest.fn(() => Promise.resolve());
    const mockS3Bucket = partial<S3Bucket>({
      doesObjectExist: mockS3BucketDoesObjectExist,
      putObjectStream: mockS3BucketPutObjectStream,
    });

    const mockS3ObjectNameMapper = (name: string) => name;

    const runMigration = createMigration({
      blobContainer: mockBlobContainer,
      s3Bucket: mockS3Bucket,
      s3ObjectNameMapper: mockS3ObjectNameMapper,
    });

    await runMigration();

    expect(mockS3BucketPutObjectStream.mock.calls).toEqual(expected);
  });
});
