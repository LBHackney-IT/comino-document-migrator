import { createDocumentNameMapper } from "../src/document";

describe("createDocumentNameMapper", () => {
  test("successfully creates a mapper that maps a matching blob name", () => {
    const s3Prefix = "s3-root/";
    const fileName = "test.txt";
    const blobName = `blob-root/01/02/${fileName}`;

    const expected = `${s3Prefix}${fileName}`;

    const mapS3ObjectName = createDocumentNameMapper(s3Prefix);

    const actual = mapS3ObjectName(blobName);

    expect(actual).toEqual(expected);
  });
});
