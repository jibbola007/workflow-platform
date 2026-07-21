const { plainToInstance } = require('./packages/database/node_modules/class-transformer');
const { validateSync } = require('./packages/database/node_modules/class-validator');
const { UpdateWorkItemDto } = require('./apps/backend/dist/work-items/dto');

const payload = {
  description: "New description",
  priority: "HIGH"
};

const instance = plainToInstance(UpdateWorkItemDto, payload);
const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });
console.log("Instance:", instance);
console.log("Errors:", errors);
