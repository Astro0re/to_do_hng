import { drizzle } from 'drizzle-orm/netlify-db'
import * as schema from './schema.ts'

export function getDb() {
  return drizzle({ schema })
}
