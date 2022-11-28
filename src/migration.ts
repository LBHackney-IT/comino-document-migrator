import retry from "async-retry";

export interface DocumentMetadata {
  name: string;
  contentLength?: number;
}

export interface DocumentContent {
  body?: ReadableStream;
  contentType?: string;
}

export interface DocumentSource {
  listDocuments(): AsyncIterable<DocumentMetadata>;
  getDocumentContent(name: string): Promise<DocumentContent>;
}

export interface DocumentDestination {
  doesDocumentExist(name: string, contentLength: number): Promise<boolean>;
  putDocumentContent(
    name: string,
    contentType?: string,
    body?: ReadableStream
  ): Promise<void>;
}

export interface MigrationConfig {
  documentSource: DocumentSource;
  documentDestination: DocumentDestination;
  documentNameMap: (blobName: string) => string;
  maxConcurrentDocuments?: number;
  maxRetriesPerDocument?: number;
}

export const createDocumentMigration =
  ({
    documentSource,
    documentDestination,
    documentNameMap: mapDocumentName,
    maxConcurrentDocuments = 32,
    maxRetriesPerDocument = 10,
  }: MigrationConfig) =>
  async () => {
    const srcDocMetadataList = documentSource.listDocuments();

    const workers = new Array(maxConcurrentDocuments)
      .fill(srcDocMetadataList)
      .map(async (srcDocMetadataList) => {
        for await (const srcDocMetadata of srcDocMetadataList) {
          const destDocName = mapDocumentName(srcDocMetadata.name);

          const destDocExists = await documentDestination.doesDocumentExist(
            destDocName,
            srcDocMetadata.contentLength
          );
          if (destDocExists) {
            continue;
          }

          await retry(
            async () => {
              const srcDocContent = await documentSource.getDocumentContent(
                srcDocMetadata.name
              );
              await documentDestination.putDocumentContent(
                destDocName,
                srcDocContent.contentType,
                srcDocContent.body
              );
            },
            { retries: maxRetriesPerDocument }
          );
        }
      });

    await Promise.all(workers);
  };
