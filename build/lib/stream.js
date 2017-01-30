"use strict";
const stream_1 = require("stream");
class Stream {
    constructor() {
        this.stream = new stream_1.Readable();
    }
    push(str) {
        if (str === null) {
            return this.stream.push(null);
        }
        this.stream.push(str ? str + "\n" : "\n");
    }
    pipe(writeable) {
        return this.stream.pipe(writeable);
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Stream;
