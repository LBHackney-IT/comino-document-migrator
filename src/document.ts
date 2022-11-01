import * as path from "path";

export const createDocumentNameMapper =
  (blobPrefix: string, s3Prefix: string) => (blobName: string) => {
    if (!blobName.startsWith(blobPrefix)) {
      return blobName;
    }

    const fileName = path.basename(blobName);

    return path.join(s3Prefix, fileName);
  };
