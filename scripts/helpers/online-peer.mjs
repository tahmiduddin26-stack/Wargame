import { WebSocket } from 'ws';

export class OnlinePeer {
  constructor(url, options) {
    this.ws = new WebSocket(url, options);
    this.messages = [];
    this.waiters = [];
    this.ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      const index = this.waiters.findIndex((entry) => entry.match(message));
      if (index >= 0) this.waiters.splice(index, 1)[0].resolve(message);
      else this.messages.push(message);
    });
  }
  async open(token) {
    await new Promise((resolve, reject) => { this.ws.once('open', resolve); this.ws.once('error', reject); });
    this.send({ t: 'hello', token });
    return this.take((message) => message.t === 'welcome');
  }
  send(message) { this.ws.send(JSON.stringify(message)); }
  take(match, timeoutMs = 10000) {
    const index = this.messages.findIndex(match);
    if (index >= 0) return Promise.resolve(this.messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const entry = { match, resolve: (value) => { clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((item) => item !== entry);
        reject(new Error('Timed out waiting for online message'));
      }, timeoutMs);
      this.waiters.push(entry);
    });
  }
  close() { this.ws.close(); }
}
