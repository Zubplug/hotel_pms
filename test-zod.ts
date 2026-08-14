import { z } from 'zod';
const schema = z.object({
  page: z.coerce.number().int().positive().default(1),
});
console.log(schema.safeParse({ page: null }));
console.log(schema.safeParse({ page: undefined }));
