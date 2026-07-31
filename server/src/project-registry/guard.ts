import { ProjectRegistryService } from './service';
import type { ValidateCodingTaskInput } from './types';

export function validateCodingTaskStart(input: ValidateCodingTaskInput): void {
  const service = new ProjectRegistryService();
  try {
    service.validateCodingTaskStart(input);
  } finally {
    service.close();
  }
}
