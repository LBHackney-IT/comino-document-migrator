import convict from "convict";

export const config = convict({
  service: {
    env: "SERVICE",
    format: String,
    default: "comino-document-migrator",
  },
  log: {
    level: {
      env: "LOG_LEVEL",
      format: String,
      default: "info",
    },
  },
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
        default: "",
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
    maxConcurrentDocuments: {
      env: "MIGRATION_MAX_CONCURRENT_DOCUMENTS",
      format: Number,
      default: 32,
    },
  },
}).getProperties();
