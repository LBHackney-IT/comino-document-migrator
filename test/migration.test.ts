import { partial } from "./helpers";
import {
  createDocumentMigration,
  DocumentSource,
  DocumentDestination,
} from "../src/migration";

describe("createDocumentMigration", () => {
  test("successfully creates a migration that only copies new documents", async () => {
    const documents = [
      {
        name: "1.txt",
        contentLength: 1,
        contentType: "text/plain",
        exists: false,
      },
      {
        name: "2.txt",
        contentLength: 2,
        contentType: "text/plain",
        exists: false,
      },
      {
        name: "3.txt",
        contentLength: 5,
        contentType: "text/plain",
        exists: true,
      },
      {
        name: "4.txt",
        contentLength: 4,
        contentType: "text/plain",
        exists: false,
      },
      {
        name: "5.txt",
        contentLength: 3,
        contentType: "text/plain",
        exists: true,
      },
    ];

    const expected = documents
      .filter((document) => !document.exists)
      .map(({ name, contentType }) => [
        name,
        contentType,
        partial<ReadableStream>({}),
      ]);

    const mockDocumentSourceGetDocumentContent = jest.fn();
    documents.forEach(({ contentType }) =>
      mockDocumentSourceGetDocumentContent.mockResolvedValueOnce({
        contentType,
        body: partial<ReadableStream>({}),
      })
    );
    const mockDocumentSource = partial<DocumentSource>({
      listDocuments: async function* () {
        for (const { name, contentLength } of documents) {
          yield { name, contentLength };
        }
      },
      getDocumentContent: mockDocumentSourceGetDocumentContent,
    });

    const mockDocumentDestinationDoesDocumentExist = jest.fn();
    documents.forEach((document) =>
      mockDocumentDestinationDoesDocumentExist.mockResolvedValueOnce(
        document.exists
      )
    );
    const mockDocumentDestinationPutDocumentContent = jest.fn(() =>
      Promise.resolve()
    );
    const mockDocumentDestination = partial<DocumentDestination>({
      doesDocumentExist: mockDocumentDestinationDoesDocumentExist,
      putDocumentContent: mockDocumentDestinationPutDocumentContent,
    });

    const mockDocumentNameMapper = (name: string) => name;

    const runMigration = createDocumentMigration({
      documentSource: mockDocumentSource,
      documentDestination: mockDocumentDestination,
      documentNameMap: mockDocumentNameMapper,
    });

    await runMigration();

    expect(mockDocumentDestinationPutDocumentContent.mock.calls).toEqual(
      expected
    );
  });
});
