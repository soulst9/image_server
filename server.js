'use strict'

const app = require('./app');
const http = require('http');
const normalizePort = require('normalize-port')

const port = normalizePort(process.env.PORT || '7100');
app.set('port', port);

const server = http.createServer(app).listen(port, () => {
    console.log(`listening on ${port}`);
});
