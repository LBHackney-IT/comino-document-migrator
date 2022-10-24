import { partial } from "./helpers";
import {
  ContainerClient,
  ContainerListBlobFlatSegmentResponse,
} from "@azure/storage-blob";
import { ObjectListStream } from "../src/azure";

describe("ObjectListStream", () => {
  describe("_read", () => {
    test("successfully emits the objects in storage", (done) => {
      const pages = [["1.js", "2.js"], ["3.js", "4.js"], ["5.js"]];
      const results = [
        ...pages.map((page) =>
          partial<IteratorYieldResult<ContainerListBlobFlatSegmentResponse>>({
            value: {
              segment: {
                blobItems: page.map((name) => ({ name })),
              },
            },
          })
        ),
        partial<IteratorReturnResult<unknown>>({
          done: true,
        }),
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

      const objectListStream = new ObjectListStream(mockContainerClient);

      let actual: string[] = [];
      objectListStream
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
  });
});
