import { Transform, TransformCallback } from "stream";
import { EventEmitter } from "events";
import { RateLimit } from "async-sema";

export interface ThrottledTransformStreamOptions {
  objectMode?: boolean;
  queriesPerSecond?: number;
  uniformDistribution?: boolean;
}

export class ThrottledTransformStream extends Transform {
  private stream: Transform;
  private limit: () => Promise<void>;
  private count = 0;
  private done?: EventEmitter;

  constructor(stream: Transform, options?: ThrottledTransformStreamOptions) {
    super({ objectMode: options?.objectMode ?? false });

    this.stream = stream;
    this.limit = RateLimit(options?.queriesPerSecond ?? 100, {
      uniformDistribution: options?.uniformDistribution ?? false,
    });
  }

  _transform(
    chunk: unknown,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    this.count++;

    this.limit().then(() => {
      this.stream._transform(chunk, encoding, (err, res) => {
        if (err) {
          this.emit("error", err);
        } else if (res) {
          this.push(res);
        }

        this.count--;

        if (this.done && !this.count) {
          this.done.emit("finish");
        }
      });
    });

    callback();
  }

  _flush(callback: TransformCallback): void {
    const flush = () => {
      if (!this.stream._flush) {
        return callback();
      }

      this.stream._flush(callback);
    };

    if (!this.count) {
      return flush();
    }

    this.done = new EventEmitter();
    this.done.once("finish", flush);
  }
}
