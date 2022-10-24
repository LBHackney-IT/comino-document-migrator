import { Readable } from "stream";

export class ObjectListStream extends Readable {
  constructor(containerClient, options) {
    super();

    this.options = {
      pageSize: 100,
      ...options,
    };

    this.iterator = containerClient
      .listBlobsFlat()
      .byPage({ maxPageSize: this.options.pageSize });

    this.queue = [];
    this.loading = false;
    this.done = false;
  }

  _read() {
    if (this.loading) {
      return;
    }

    if (this.done) {
      this.push(null);

      return;
    }

    if (!this.isEmpty()) {
      const item = this.shift();
      this.push(item);

      return;
    }

    this.page()
      .then((page) => {
        this.emit("page", page);

        const item = this.shift();
        this.push(item);
      })
      .catch((err) => this.emit("error", err));
  }

  async page() {
    this.loading = true;

    const res = await this.iterator.next();

    if (res.done) {
      this.done = true;

      return { token: "", count: 0 };
    }

    const { continuationToken, segment } = res.value;

    this.queue = segment.blobItems.map((x) => x.name);
    this.loading = false;

    return { token: continuationToken, count: this.queue.length };
  }

  shift() {
    return this.queue.shift();
  }

  isEmpty() {
    return this.queue.length == 0;
  }
}
