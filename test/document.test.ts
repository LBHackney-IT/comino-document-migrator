import { createDocumentNameMapper } from "../src/document";

describe("createDocumentNameMapper", () => {
  test("successfully creates a mapper that maps a matching blob name", () => {
    const blobPrefix = "blob-root/";
    const s3Prefix = "s3-root/";
    const fileName = "test.txt";
    const blobName = `${blobPrefix}01/02/${fileName}`;

    const expected = `${s3Prefix}${fileName}`;

    const mapS3ObjectName = createDocumentNameMapper(blobPrefix, s3Prefix);

    const actual = mapS3ObjectName(blobName);

    expect(actual).toEqual(expected);
  });

  test("successfully creates a mapper that ignores a blob name that doesn't match", () => {
    const blobPrefix = "blob-root/";
    const s3Prefix = "s3-root/";
    const blobName = "other-root/01/02/test.txt";

    const expected = blobName;

    const mapS3ObjectName = createDocumentNameMapper(blobPrefix, s3Prefix);

    const actual = mapS3ObjectName(blobName);

    expect(actual).toEqual(expected);
  });
});
