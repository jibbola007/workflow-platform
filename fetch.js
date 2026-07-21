const http = require('http');

const data = JSON.stringify({
  description: 'Testing description only'
});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/work-items/b5d2c6c3-1f19-4809-b687-f8313e648821', // Note: Need a valid ID, but let's see what it returns
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
