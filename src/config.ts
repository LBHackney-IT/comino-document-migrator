import convict from "convict";

export const config = convict({
  azure: {
    blob: {
      url: {
        env: "AZURE_BLOB_URL",
        format: String,
        default: "",
      },
      containerName: {
        env: "AZURE_BLOB_CONTAINER_NAME",
        format: String,
        default: "",
      },
    },
  },
  aws: {
    accessKeyId: {
      env: "AWS_ACCESS_KEY_ID",
      format: String,
      default: "",
    },
    secretAccessKey: {
      env: "AWS_SECRET_ACCESS_KEY",
      format: String,
      default: "",
    },
    sessionToken: {
      env: "AWS_SESSION_TOKEN",
      format: String,
      default: undefined,
    },
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
    },
  },
}).getProperties();
