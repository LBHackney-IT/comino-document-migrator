# Comino Document Migrator

A worker that migrates files from Civica's Azure Blob storage to an AWS S3 bucket.

## Contributing

### Prerequisites

- Install Node.js (>=v16)
- Install Docker (>=v20.10)
- Clone this repository
- Open the project in your editor of choice

### Setup

The following environment variables are required in order to run the application:

- `AZURE_BLOB_URL` - The Azure Blob storage container URL including the [SAS token](https://learn.microsoft.com/en-us/azure/cognitive-services/translator/document-translation/create-sas-tokens?tabs=Containers)
- `AZURE_BLOB_CONTAINER_NAME` - The Azure Blob storage container name
- `AWS_ACCESS_KEY_ID` - The AWS Access Key ID used for accessing the S3 bucket
- `AWS_SECRET_ACCESS_KEY` - The AWS Secret Access Key used for accessing the S3 bucket
- `AWS_REGION` - The AWS region of the S3 bucket
- `AWS_S3_BUCKET_NAME` - The S3 bucket name

In addition, the following environment variables can be optionally added to the environment:

- `AZURE_BLOB_PREFIX` - The prefix of the blobs that should be migrated from the Azure Blob storage container
- `AZURE_BLOB_PAGE_SIZE` - The size of the pages of blobs when listing the blobs to be copied from the Azure Blob storage container
- `AWS_SESSION_TOKEN` - The AWS Session Token used for accessing the S3 bucket
- `AWS_S3_PREFIX` - The prefix of the objects that are being migrated to the S3 bucket
- `MIGRATION_MAX_DOCUMENTS_PER_SECOND` - The max amount of documents that should be migrated per second
- `MIGRATION_MAX_RETRIES_PER_DOCUMENT` - The max amount times that a document migration should be retried

### Test

The following command will run the tests:

```
npm run test
```

### Build

The following command will build the application:

```
npm run build
```

### Run

The following command will run the built application:

```
npm run start
```
