import { Writable } from 'stream';

/**
 * Support an "in memory" stream used for testing.
 */
export default class InMemorySteam extends Writable {
  #chunks = [];

  // eslint-disable-next-line no-underscore-dangle
  _write(chunk, end, next) {
    this.#chunks.push(chunk.toString('utf8'));
    next();
  }

  public readAsString(): string {
    return this.#chunks.join('\n');
  }

  public readAsObject(): any {
    const loggedMessages = this.#chunks.join(',');

    // NOTE: Need to wrap messages in an array because we may have logged
    //       more than one time.
    return loggedMessages ? JSON.parse(`[${loggedMessages}]`) : null;
  }

  public reset() {
    this.#chunks = [];
  }
}
