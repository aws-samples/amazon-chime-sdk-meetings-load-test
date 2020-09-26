const express = require('express');
const app = express();


app.get('/', (request, response, nextHandler) => {
  response.send('Hello node!');
  console.log(`Served by worker with process id (PID) ${process.pid}.`);
});

const server = require('http').createServer(app);

server.on('listening', () => {
  console.log("App listening on port 3000");
})
server.listen(3000);
