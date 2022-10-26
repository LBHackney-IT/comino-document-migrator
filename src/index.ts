import { Transform } from "stream";
import { BlobServiceClient } from "@azure/storage-blob";
import { config } from "./config";
import { AzureBlobListStream } from "./storage";
import { ThrottledTransformStream } from "./throttle";

const blobServiceClient = new BlobServiceClient(config.azure.blobStorage.url);
const containerClient = blobServiceClient.getContainerClient(
  config.azure.blobStorage.containerName
);
const objectListStream = new AzureBlobListStream(containerClient, {
  pageSize: 3,
});
const transform = new Transform({
  transform: (chunk, _encoding, callback) => callback(null, chunk),
});
const throttledStream = new ThrottledTransformStream(transform, {
  uniformDistribution: true,
});

objectListStream.pipe(throttledStream).on("data", (result) => {
  console.log(result.toString());
});
