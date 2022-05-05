const express = require('express')
const morgan = require('morgan')
const db = require('./database')
const fs = require('fs');
const app = express()
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const args = require('minimist')(process.argv.slice(2))
const port = args.port || process.env.port || 5000
const server = app.listen(port, () => {
    console.log('App listening on port %PORT%'.replace('%PORT%', port))
});

const help = (`
server.js [options]
--port	Set the port number for the server to listen on. Must be an integer
            between 1 and 65535.
--debug	If set to true, creates endlpoints /app/log/access/ which returns
            a JSON access log from the database and /app/error which throws 
            an error with the message "Error test successful." Defaults to 
            false.
--log		If set to false, no log files are written. Defaults to true.
            Logs are always written to database.
--help	Return this message and exit.
`)
if (args.help || args.h) {
    console.log(help)
    process.exit(0)
}

if (args.log == 'false') {
    console.log("NOTICE: not creating file access.log")
} else {
    const accessLog = fs.createWriteStream('access.log', { flags: 'a' })
    app.use(morgan('combined', { stream: accessLog }))
}

app.use( (req, res, next) => {
    let logdata = {
        remoteaddr: req.ip,
        remoteuser: req.user,
        time: Date.now(),
        method: req.method,
        url: req.url,
        protocol: req.protocol,
        httpversion: req.httpVersion,
        status: res.statusCode,
        referer: req.headers['referer'],
        useragent: req.headers['user-agent']
    }

    console.log(logdata)
    const stmt = db.prepare('INSERT INTO accesslog (remoteaddr, remoteuser, time, method, url, protocol, httpversion, status, referer, useragent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const info = stmt.run(logdata.remoteaddr, logdata.remoteuser, logdata.time, logdata.method, logdata.url, logdata.protocol, logdata.httpversion, logdata.status, logdata.referer, logdata.useragent)
    next();
  });

  if ((args.debug == true) || (args.d == true)) {
    app.get('/app/log/access', (req, res, next) => {
      const statement = db.prepare('SELECT * FROM accesslog').all();
      res.status(200).json(statement);
  });

  app.get('/app/error', (req, res, next) => {
    throw new Error('Successful: Error.')
  })
}

// Default response for any other request
app.use(function(req, res){
    res.status(404).send('404 NOT FOUND')
});

// Check endpoint
app.get('/app/', (req, res) => {
    // Respond with status 200
        res.statusCode = 200;
    // Respond with status message "OK"
        res.statusMessage = 'OK';
        res.writeHead(res.statusCode, { 'Content-Type' : 'text/plain' });
        res.end(res.statusCode+ ' ' +res.statusMessage)
});

// Multiple flips endpoint
app.get('/app/flips/:number', (req, res) => {
    let num = parseInt(req.params.number);
    let flips = coinFlips(num);
    let count = countFlips(flips);
    let out = {raw: flips, summary: count};

    res.status(200).json(out);
});

// Single flip endpoint
app.get('/app/flip/', (req, res) => {
	const result = coinFlip();
    const out = {flip: result};

    res.status(200).json(out);
});

// Guess flip endpoint
app.get('/app/flip/call/:call', (req, res) => {
    const call = req.params.call;
    const out = flipACoin(call);

    res.status(200).json(out);
});

// Coin funcs
function coinFlip() {
    return Math.floor(Math.random() * 2) == 0 ? "heads" : "tails"
  }

function coinFlips(flips) {
    const resultArr = new Array(flips);
    for(var i = 0; i < flips; i++) {
      resultArr[i] = coinFlip();
    }
    return resultArr;
}  

function countFlips(array) {
    let heads = 0;
    let tails = 0;
  
    for (let i = 0; i < array.length; i++) {
      if (array[i] == "heads") {
        heads++;
      } else {
        tails++;
      }
    }

    return "{ heads: " + heads + ", tails: " + tails + " }";
  }

function flipACoin(call) {
    var flip = coinFlip();
    return {call: call, flip: flip, result: flip == call ? "win" : "lose" }
}