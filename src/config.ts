import convict from "convict";

export const config = convict({
  azure: {
    blobStorage: {
      url: {
        env: "AZURE_BLOB_STORAGE_URL",
        format: String,
        default: "",
      },
      containerName: {
        env: "AZURE_BLOB_STORAGE_CONTAINER_NAME",
        format: String,
        default: "",
      },
    },
  },
}).getProperties();