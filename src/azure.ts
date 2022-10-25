import { Readable } from "stream";
import {
  ContainerClient,
  ContainerListBlobFlatSegmentResponse,
} from "@azure/storage-blob";

export interface ObjectListStreamOptions {
  pageSize?: number;
}

export class ObjectListStream extends Readable {
  private iterator: AsyncIterableIterator<ContainerListBlobFlatSegmentResponse>;
  private queue: string[] = [];

  constructor(
    containerClient: ContainerClient,
    options?: ObjectListStreamOptions
  ) {
    super();

    this.iterator = containerClient
      .listBlobsFlat()
      .byPage({ maxPageSize: options?.pageSize ?? 100 });
  }

  _read() {
    if (this.queue.length > 0) {
      const item = this.queue.shift();
      this.push(item);

      return;
    }

    this.iterator
      .next()
      .then((res) => {
        if (res.done) {
          this.push(null);

          return;
        }

        this.queue = res.value.segment.blobItems.map((x) => x.name);

        const item = this.queue.shift();
        this.push(item);
      })
      .catch((err) => this.emit("error", err));
  }
}
