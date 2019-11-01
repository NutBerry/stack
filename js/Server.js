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
    server.listen(options.port, options.host);

    this.log(`listening on ${options.host}:${options.port}`);
  }

  log (...args) {
    console.log('Server:', ...args);
  }

  // TODO: try : catch for bad requests
  onRequest (req, resp) {
    if (req.method === 'POST') {
      const self = this;
      let body = Buffer.alloc(0);
      req.on('data', function (buf) {
        body = Buffer.concat([body, buf]);
      });
      req.on('end', function () {
        self.onPost(req, resp, JSON.parse(body.toString()));
      });
      return;
    }

    this.onGet(req, resp);
  }

  async onGet (req, resp) {
    resp.end();
  }

  async onPost (req, resp, body) {
    const method = body.method;

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
        body.result = await func(body, this.bridge);
        resp.end(JSON.stringify(body));
      } catch (e) {
        console.log(e, e.stack);
        body.error = {
          code: -32000,
          message: e.toString(),
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
