'use strict';

const http = require('http');

const Methods = require('./Methods');
const Bridge = require('./Bridge');

module.exports = class Server {
  constructor (options) {
    this.bridge = new Bridge(options);

    // TODO:
    // - start the server after the bridge is properly initialized
    // - allow for a https option (path to cert/key)
    // - use HTTP/2
    const server = new http.Server(this.onRequest.bind(this));
    // timeout after 120 seconds
    server.timeout = 120000;
    server.listen(options.rpcPort, options.host);

    this.log(`listening on ${options.host}:${options.rpcPort}`);
  }

  log (...args) {
    console.log('Server:', ...args);
  }

  onRequest (req, resp) {
    resp.sendDate = false;
    resp.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'POST') {
      const len = parseInt(req.headers['content-length']);
      // should have content-length set and not over 8 Mbytes
      if (!len || len > 8 << 20) {
        resp.writeHead(413);
        resp.end();
        return;
      }

      const self = this;
      let body = Buffer.alloc(0);
      req.on('data', function (buf) {
        body = Buffer.concat([body, buf]);

        if (body.length > len) {
          resp.abort();
        }
      });
      req.on('end', async function () {
        try {
          await self.onPost(req, resp, JSON.parse(body.toString()));
        } catch (e) {
          resp.writeHead(400);
          resp.end();
        }
      });
      return;
    }

    resp.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, X-Requested-With');
    resp.end();
  }

  async onPost (req, resp, body) {
    const method = body.method;

    this.log(method);

    if (method.startsWith('debug') && !this.bridge.debugMode) {
      body.error = {
        code: -32601,
        message: 'DebugMode is not enabled',
      };
      resp.end(JSON.stringify(body));
      return;
    }

    if (Methods.hasOwnProperty(method)) {
      const func = Methods[method];

      try {
        if (!this.bridge.ready) {
          throw new Error('Bridge is not ready yet');
        }

        body.result = await func(body, this.bridge);
        resp.end(JSON.stringify(body));
      } catch (e) {
        console.log(e, e.stack);
        body.error = {
          code: -32000,
          message: (e.message || e).toString(),
        };
        resp.end(JSON.stringify(body));
      }
      return;
    }

    body.error = {
      code: -32601,
      message: `The method ${method} does not exist/is not available`,
    };
    resp.end(JSON.stringify(body));
  }
};
