import { BlobServiceClient } from "@azure/storage-blob";
import { config } from "./config";
import { AzureBlobListStream } from "./storage";

const blobServiceClient = new BlobServiceClient(config.azure.blobStorage.url);
const containerClient = blobServiceClient.getContainerClient(
  config.azure.blobStorage.containerName
);
const objectListStream = new AzureBlobListStream(containerClient, {
  pageSize: 3,
});

objectListStream.on("data", (result) => {
  console.log(result.toString());
});
