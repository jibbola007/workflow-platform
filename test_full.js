const http = require('http');
async function test() {
  const data = JSON.stringify({
    title: "Test task",
    description: null,
    status: "BACKLOG",
    priority: "HIGH",
    estimate: null,
    assigneeId: null,
    parentEpicId: null
  });

  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/work-items/some-uuid', 
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  // wait we need a valid ID. let's just make a POST to create one, then PATCH it.
  const req = http.request({
    ...options, method: 'POST', path: '/work-items'
  }, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      console.log('POST status', res.statusCode);
      if (res.statusCode > 300) {
        console.log(body);
        return;
      }
      const item = JSON.parse(body);
      console.log("Created item:", item.id);
      
      const patchReq = http.request({
        ...options, path: '/work-items/' + item.id, method: 'PATCH'
      }, res2 => {
        let b = '';
        res2.on('data', d => b += d);
        res2.on('end', () => {
          console.log('PATCH status', res2.statusCode);
          console.log(b);
        });
      });
      patchReq.write(data);
      patchReq.end();
    });
  });

  req.write(JSON.stringify({ title: "Test task", description: "Initial description", workspaceId: "77777777-7777-7777-7777-777777777777", type: "TASK" }));
  req.end();
}
test();
