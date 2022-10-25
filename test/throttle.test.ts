import { Readable, Transform, TransformCallback } from "stream";
import { ThrottledTransformStream } from "../src/throttle";

describe("ThrottledTransformStream", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("_transform", () => {
    test("successfully performs concurrent transforms", (done) => {
      const inputs = [...Array(5).keys()].map((key) => key.toString());
      const inputStream = new Readable();
      inputs.map((input) => inputStream.push(input));
      inputStream.push(null);

      const mapResult = (input: Buffer | string) => `result-${input}`;
      const expected = inputs.map((input) => mapResult(input));

      const mockTransform = new Transform({
        transform: (
          chunk: Buffer,
          _: BufferEncoding,
          callback: TransformCallback
        ): void => callback(null, mapResult(chunk)),
        flush: (callback: TransformCallback): void => callback(),
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
  });
});
