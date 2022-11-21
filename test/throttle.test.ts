import { Readable, Transform, TransformCallback } from "stream";
import { ThrottledTransformStream } from "../src/throttle";

describe("ThrottledTransformStream", () => {
  describe("_transform", () => {
    for (const { testName, flush } of [
      {
        testName: "successfully performs transforms with flush",
        flush: (callback: TransformCallback): void => callback(),
      },
      {
        testName: "successfully performs transforms without flush",
        flush: undefined,
      },
    ]) {
      test(testName, (done) => {
        const inputs = [...Array(5).keys()].map((key) => key.toString());
        const inputStream = new Readable();
        inputs.map((input) => inputStream.push(input));
        inputStream.push(null);

        const mapResult = (input: Buffer | string) => `result-${input}`;
        const expected = inputs.map((input) => mapResult(input));

        const mockTransform = new Transform({
          transform: (chunk, _encoding, callback) =>
            callback(null, mapResult(chunk)),
          flush,
        });

        const throttledStream = new ThrottledTransformStream(mockTransform);

        let actual: string[] = [];
        inputStream
          .pipe(throttledStream)
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
    }

    test("successfully performs no transforms", (done) => {
      const inputStream = new Readable();
      inputStream.push(null);

      const expected: string[] = [];

      const mockTransform = new Transform({
        transform: (chunk, _encoding, callback) => callback(null, chunk),
      });

      const throttledStream = new ThrottledTransformStream(mockTransform);

      let actual: string[] = [];
      inputStream
        .pipe(throttledStream)
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
      const inputStream = new Readable();
      inputStream.push("1");
      inputStream.push(null);

      const errorMessage = "test error";
      const expected = new Error("test error");

      const mockTransform = new Transform({
        transform: (_chunk, _encoding, callback) =>
          callback(new Error(errorMessage)),
      });

      const throttledStream = new ThrottledTransformStream(mockTransform);

      inputStream
        .pipe(throttledStream)
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
