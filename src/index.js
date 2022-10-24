import { BlobServiceClient } from "@azure/storage-blob";
import { ObjectListStream } from "./azure.js";
import { config } from "./config.js";

const blobServiceClient = new BlobServiceClient(config.azure.blobStorage.url);
const containerClient = blobServiceClient.getContainerClient(
  config.azure.blobStorage.containerName
);
const objectListStream = new ObjectListStream(containerClient, { pageSize: 3 });

objectListStream.on("data", (results) => {
  console.log(results.toString());
});
