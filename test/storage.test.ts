import { partial } from "./helpers";
import { ContainerClient } from "@azure/storage-blob";
import { AzureBlobListStream } from "../src/storage";

describe("AzureBlobListStream", () => {
  describe("_read", () => {
    test("successfully emits the objects in storage", (done) => {
      const pages = [["1.js", "2.js"], ["3.js", "4.js"], ["5.js"]];
      const results = [
        ...pages.map((page) => ({
          value: {
            segment: {
              blobItems: page.map((name) => ({ name })),
            },
          },
        })),
        {
          done: true,
        },
      ];

      const expected = pages.reduce((acc, page) => [...acc, ...page], []);

      const mockContainerClient = partial<ContainerClient>({
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
      });

      const stream = new AzureBlobListStream(mockContainerClient);

      let actual: string[] = [];
      stream
        .on("data", (result) => {
          actual = [...actual, result.toString()];
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
      const errorMessage = "test error";
      const expected = new Error(errorMessage);

      const mockContainerClient = partial<ContainerClient>({
        listBlobsFlat: () => ({
          byPage: () => ({
            next: () => {
              return Promise.reject(new Error(errorMessage));
            },
          }),
        }),
      });

      const stream = new AzureBlobListStream(mockContainerClient);

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