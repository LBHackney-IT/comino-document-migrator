import { partial } from "./helpers";
import { BlobServiceClient as BlobClient } from "@azure/storage-blob";
import { BlobListStream } from "../src/storage";

describe("BlobListStream", () => {
  describe("_read", () => {
    test("successfully emits the objects in storage", (done) => {
      const containerName = "test";
      const pages = [["1.js", "2.js"], ["3.js", "4.js"], ["5.js"]].map((page) =>
        page.map((name) => ({ name }))
      );
      const results = [
        ...pages.map((page) => ({
          value: {
            segment: {
              blobItems: page,
            },
          },
        })),
        {
          done: true,
        },
      ];

      const expected = pages.reduce((acc, page) => [...acc, ...page], []);

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({
          listBlobsFlat: () => ({
            byPage: () => {
              let index = 0;
              return {
                next: () => {
                  return Promise.resolve(results[index++]);
                },
              };
            },
          }),
        }),
      });

      const stream = new BlobListStream({
        blobClient: mockBlobClient,
        blobContainerName: containerName,
      });

      let actual: string[] = [];
      stream
        .on("data", (result) => {
          actual = [...actual, result];
        })
        .on("end", () => {
          try {
            expect(actual).toEqual(expected);
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    test("successfully emits an error on failure", (done) => {
      const containerName = "test";
      const errorMessage = "test error";
      const expected = new Error(errorMessage);

      const mockBlobClient = partial<BlobClient>({
        getContainerClient: () => ({
          listBlobsFlat: () => ({
            byPage: () => ({
              next: () => {
                return Promise.reject(new Error(errorMessage));
              },
            }),
          }),
        }),
      });

      const stream = new BlobListStream({
        blobClient: mockBlobClient,
        blobContainerName: containerName,
      });

      stream
        .on("data", () => undefined)
        .on("error", (actual) => {
          try {
            expect(actual).toEqual(expected);
            done();
          } catch (err) {
            done(err);
          }
        });
    });
  });
});
