import convict from "convict";

export const config = convict({
  azure: {
    blob: {
      url: {
        env: "AZURE_BLOB_URL",
        format: String,
        default: "",
      },
      sasToken: {
        env: "AZURE_BLOB_SAS_TOKEN",
        format: String,
        default: undefined,
      },
      containerName: {
        env: "AZURE_BLOB_CONTAINER_NAME",
        format: String,
        default: "",
      },
      prefix: {
        env: "AZURE_BLOB_PREFIX",
        format: String,
        default: "",
      },
      pageSize: {
        env: "AZURE_BLOB_PAGE_SIZE",
        format: Number,
        default: 100,
      },
    },
  },
  aws: {
    region: {
      env: "AWS_REGION",
      format: String,
      default: "",
    },
    s3: {
      bucketName: {
        env: "AWS_S3_BUCKET_NAME",
        format: String,
        default: "",
      },
      prefix: {
        env: "AWS_S3_PREFIX",
        format: String,
        default: "",
      },
    },
  },
  migration: {
    maxDocumentsPerSecond: {
      env: "MIGRATION_MAX_DOCUMENTS_PER_SECOND",
      format: Number,
      default: 100,
    },
    maxRetriesPerDocument: {
      env: "MIGRATION_MAX_RETRIES_PER_DOCUMENT",
      format: Number,
      default: 10,
    },
  },
}).getProperties();
