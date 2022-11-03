import * as path from "path";

export const createDocumentNameMapper =
  (s3Prefix: string) => (blobName: string) => {
    const fileName = path.basename(blobName);

    return path.join(s3Prefix, fileName);
  };
