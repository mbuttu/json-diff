import {Readable} from "stream";

export default class Stream {
  private stream = new Readable();

  push(str?: string) {
    if (str === null) {
      return this.stream.push(null);
    }

    this.stream.push(str ? str + "\n" : "\n");
  }

  pipe(writeable: NodeJS.WritableStream) {
    return this.stream.pipe(writeable);
  }
}
