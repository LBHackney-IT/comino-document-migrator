import { BlobServiceClient } from "@azure/storage-blob";
import { ObjectListStream } from "./azure";
import { config } from "./config";

const blobServiceClient = new BlobServiceClient(config.azure.blobStorage.url);
const containerClient = blobServiceClient.getContainerClient(
  config.azure.blobStorage.containerName
);
const objectListStream = new ObjectListStream(containerClient, { pageSize: 3 });

objectListStream.on("data", (result) => {
  console.log(result.toString());
});
