import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateWorkItemDto } from './src/work-items/dto';

const payload = {
  description: "New description",
  priority: "HIGH"
};

const instance = plainToInstance(UpdateWorkItemDto, payload);
const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });
console.log("Instance:", instance);
console.log("Errors:", errors);
