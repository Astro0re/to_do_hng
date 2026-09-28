import { boolean, date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const folders = pgTable('folders', {
  id: uuid().primaryKey(),
  clientId: uuid('client_id').notNull(),
  name: text().notNull(),
  color: text().notNull().default('#879c85'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('folders_client_id_idx').on(table.clientId)])

export const tasks = pgTable('tasks', {
  id: uuid().primaryKey(),
  clientId: uuid('client_id').notNull(),
  title: text().notNull(),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  dueDate: date('due_date'),
  priority: text().notNull().default('medium'),
  completed: boolean().notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('tasks_client_id_idx').on(table.clientId)])

export const notes = pgTable('notes', {
  id: uuid().primaryKey(),
  clientId: uuid('client_id').notNull(),
  title: text().notNull().default(''),
  content: text().notNull(),
  color: text().notNull().default('sunflower'),
  reminderDate: date('reminder_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('notes_client_id_idx').on(table.clientId)])
