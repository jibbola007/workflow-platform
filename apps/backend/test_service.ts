import { NestFactory } from "@nestjs/core";
import { AppModule } from "./src/app.module";
import { WorkItemsService } from "./src/work-items/work-items.service";

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(WorkItemsService);
  
  // Find a work item
  const prisma = service["prisma"];
  const item = await prisma.workItem.findFirst();
  if (!item) {
    console.log("No work items found in database");
    await app.close();
    return;
  }
  
  console.log("Found work item:", item.id, "Current description:", item.description);
  
  // Try updating only description
  const newDesc = "Updated at " + new Date().toISOString();
  const updated = await service.update(item.assigneeId || "01d65d8c-d839-4084-b155-96f3329233cf", item.id, {
    description: newDesc
  });
  
  console.log("Service update result description:", updated.description);
  
  // Refetch from database
  const refetched = await prisma.workItem.findUnique({ where: { id: item.id } });
  console.log("Refetched from database description:", refetched?.description);
  
  await app.close();
}

test().catch(console.error);
