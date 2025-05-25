import { z } from 'zod'

// Define the schema for the add function parameters
export const addSchema = z.object({
  a: z.number(),
  b: z.number()
})

// Type inference from the schema
export type AddParams = z.infer<typeof addSchema>

// The actual add function
export async function add({ a, b }: AddParams) {
  return {
    content: [{ type: 'text' as const, text: String(a + b) }]
  }
}

// Tool definition object
export const addTool = {
  name: 'add',
  schema: addSchema.shape,
  handler: add
} 