const { PrismaClient } = require('./packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const item = await prisma.workItem.findFirst();
  if (!item) {
    console.log("No item found");
    return;
  }
  
  console.log("Updating item:", item.id);
  const res = await fetch(`http://localhost:4000/work-items/${item.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      // We might need a valid token. Let's see if the route is protected.
      // Or we could mock CurrentUser.
      // Wait, is there a bypass or mock for test?
    },
    body: JSON.stringify({
      description: 'Testing description via fetch ' + Date.now()
    })
  });
  
  console.log(res.status);
  console.log(await res.text());
}
main();
