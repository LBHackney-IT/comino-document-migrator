import { Transform, TransformCallback } from "stream";
import { EventEmitter } from "events";
import { Sema } from "async-sema";

export interface ThrottledTransformStreamOptions {
  objectMode?: boolean;
  maxConcurrency?: number;
}

export class ThrottledTransformStream extends Transform {
  private stream: Transform;
  private sema: Sema;
  private count = 0;
  private done?: EventEmitter;

  constructor(stream: Transform, options?: ThrottledTransformStreamOptions) {
    super({ objectMode: options?.objectMode ?? false });

    this.stream = stream;
    this.sema = new Sema(options?.maxConcurrency ?? 100);
  }

  _transform(
    chunk: unknown,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    this.count++;

    this.sema
      .acquire()
      .then(() => {
        callback();

        return new Promise((resolve, reject) =>
          this.stream._transform(chunk, encoding, (err, res) => {
            if (err) {
              reject(err);

              return;
            }

            resolve(res);
          })
        );
      })
      .then((res) => this.push(res))
      .catch((err) => this.emit("error", err))
      .then(() => {
        this.count--;

        if (this.done && !this.count) {
          this.done.emit("finish");
        }
      })
      .finally(() => this.sema.release());
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
