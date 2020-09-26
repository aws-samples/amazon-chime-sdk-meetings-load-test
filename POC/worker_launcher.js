const cluster = require('cluster');
//const cluster = require('worker_threads');
const os = require('os');

if (cluster.isMaster) {
  // Take advantage of multiple CPUs
  const cpus = os.cpus().length;

  console.log(`Taking advantage of ${cpus} CPUs`)
  for (let i = 0; i < cpus-2; i++) {
    const worker = cluster.fork();
    worker.send({workerId : worker.id});
  }
  // set console's directory so we can see output from workers
  console.dir(cluster.workers, {depth: 0});

  // initialize our CLI
  process.stdin.on('data', (data) => {
    initControlCommands(data);
  })

  cluster.on('exit', (worker, code) => {
    // Good exit code is 0 :))
    if (code !== 0 && !worker.exitedAfterDisconnect) {
      console.log(`\x1b[34mWorker ${worker.process.pid} crashed.\nStarting a new worker...\n\x1b[0m`);
      const nw = cluster.fork();
      console.log(`\x1b[32mWorker ${nw.process.pid} will replace him \x1b[0m`);
    }
  });
  console.log(`Master PID: ${process.pid}`)
} else {
  const startTimeMs = Date.now();
  // Receive messages from the master process.
  process.on('message', function(msg) {
    require('./client_launcher.js')(msg);
  });
  process.on('disconnect', function(msg) {
    const stopTimeMs = Date.now();
    console.log('Worker ' + msg.workerId +' execution time' + stopTimeMs-startTimeMs);
  });
}
