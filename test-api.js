const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/night-audit/status?propertyId=9b8a4229-4059-42f4-9565-51cfdbe79046',
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log(data));
});

req.on('error', error => {
  console.error(error);
});

req.end();
