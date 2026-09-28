import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '../../db/index.ts'
import { folders, notes, tasks } from '../../db/schema.ts'

const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
class ApiError extends Error { constructor(status, message) { super(message); this.status = status } }
function apiPayload(value) {
  if (Array.isArray(value)) return value.map(apiPayload)
  if (!value || typeof value !== 'object' || value instanceof Date) return value
  const keyNames = { folderId: 'folder_id', dueDate: 'due_date', reminderDate: 'reminder_date', createdAt: 'created_at' }
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'clientId')
    .map(([key, item]) => [keyNames[key] || key, apiPayload(item)]))
}
const jsonResponse = (payload, status = 200) => new Response(payload === null ? null : JSON.stringify(apiPayload(payload)), { status, headers: payload === null ? undefined : { 'Content-Type': 'application/json' } })

function validateDate(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(422, 'Date must use YYYY-MM-DD format')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ApiError(422, 'Date is invalid')
  return value
}
function validateColor(value, allowed) { if (!allowed.includes(value)) throw new ApiError(422, 'Color is invalid'); return value }

export function createDatabaseRepository(database = getDb()) {
  return {
    listTasks: (clientId, folderId) => database.select().from(tasks).where(folderId ? and(eq(tasks.clientId, clientId), eq(tasks.folderId, folderId)) : eq(tasks.clientId, clientId)),
    listFolders: (clientId) => database.select().from(folders).where(eq(folders.clientId, clientId)),
    listNotes: (clientId) => database.select().from(notes).where(eq(notes.clientId, clientId)).orderBy(desc(notes.createdAt)),
    createTask: async (value) => (await database.insert(tasks).values(value).returning())[0],
    createFolder: async (value) => (await database.insert(folders).values(value).returning())[0],
    createNote: async (value) => (await database.insert(notes).values(value).returning())[0],
    findTask: async (clientId, id) => (await database.select().from(tasks).where(and(eq(tasks.clientId, clientId), eq(tasks.id, id))).limit(1))[0],
    findFolder: async (clientId, id) => (await database.select().from(folders).where(and(eq(folders.clientId, clientId), eq(folders.id, id))).limit(1))[0],
    findNote: async (clientId, id) => (await database.select().from(notes).where(and(eq(notes.clientId, clientId), eq(notes.id, id))).limit(1))[0],
    updateTask: async (clientId, id, value) => (await database.update(tasks).set(value).where(and(eq(tasks.clientId, clientId), eq(tasks.id, id))).returning())[0],
    updateNote: async (clientId, id, value) => (await database.update(notes).set(value).where(and(eq(notes.clientId, clientId), eq(notes.id, id))).returning())[0],
    deleteTask: (clientId, id) => database.delete(tasks).where(and(eq(tasks.clientId, clientId), eq(tasks.id, id))),
    deleteFolder: (clientId, id) => database.delete(folders).where(and(eq(folders.clientId, clientId), eq(folders.id, id))),
    deleteNote: (clientId, id) => database.delete(notes).where(and(eq(notes.clientId, clientId), eq(notes.id, id))),
  }
}

export function createApiHandler(createRepository = () => createDatabaseRepository()) {
  return async function handleApiRequest(request) {
    const url = new URL(request.url)
    const route = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
    const method = request.method.toUpperCase()
    if (route === '/health' && method === 'GET') return jsonResponse({ status: 'ok' })
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) return jsonResponse({ detail: 'Method not allowed' }, 405)
    const clientId = request.headers.get('x-user-id') || ''
    if (!userIdPattern.test(clientId)) return jsonResponse({ detail: 'A valid client ID is required' }, 400)

    try {
      const repository = createRepository()
      if (route === '/tasks' && method === 'GET') return jsonResponse(await repository.listTasks(clientId, url.searchParams.get('folder_id')))
      if (route === '/folders' && method === 'GET') return jsonResponse(await repository.listFolders(clientId))
      if (route === '/notes' && method === 'GET') return jsonResponse(await repository.listNotes(clientId))

      let payload = null
      if (method === 'POST' || method === 'PATCH') {
        try { payload = await request.json() } catch { throw new ApiError(400, 'Request body must be valid JSON') }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ApiError(422, 'Request body must be an object')
      }

      if (route === '/tasks' && method === 'POST') {
        const title = typeof payload.title === 'string' ? payload.title.trim() : ''
        if (!title || title.length > 160) throw new ApiError(422, 'Title must be between 1 and 160 characters')
        const priority = payload.priority ?? 'medium'
        if (!['low', 'medium', 'high'].includes(priority)) throw new ApiError(422, 'Priority is invalid')
        const folderId = payload.folder_id || null
        if (folderId && !await repository.findFolder(clientId, folderId)) throw new ApiError(404, 'Folder not found')
        return jsonResponse(await repository.createTask({ id: crypto.randomUUID(), clientId, title, folderId, dueDate: validateDate(payload.due_date), priority, completed: false }), 201)
      }

      const taskMatch = route.match(/^\/tasks\/([^/]+)$/)
      if (taskMatch) {
        const id = decodeURIComponent(taskMatch[1]); const task = await repository.findTask(clientId, id)
        if (!task) throw new ApiError(404, 'Task not found')
        if (method === 'DELETE') { await repository.deleteTask(clientId, id); return jsonResponse(null, 204) }
        if (method === 'PATCH') {
          const changes = {}
          if ('title' in payload) { const title = typeof payload.title === 'string' ? payload.title.trim() : ''; if (!title || title.length > 160) throw new ApiError(422, 'Title must be between 1 and 160 characters'); changes.title = title }
          if ('folder_id' in payload) { if (payload.folder_id && !await repository.findFolder(clientId, payload.folder_id)) throw new ApiError(404, 'Folder not found'); changes.folderId = payload.folder_id || null }
          if ('due_date' in payload) changes.dueDate = validateDate(payload.due_date)
          if ('priority' in payload) { if (!['low', 'medium', 'high'].includes(payload.priority)) throw new ApiError(422, 'Priority is invalid'); changes.priority = payload.priority }
          if ('completed' in payload) { if (typeof payload.completed !== 'boolean') throw new ApiError(422, 'Completed must be true or false'); changes.completed = payload.completed }
          return jsonResponse(Object.keys(changes).length ? await repository.updateTask(clientId, id, changes) : task)
        }
      }

      if (route === '/folders' && method === 'POST') {
        const name = typeof payload.name === 'string' ? payload.name.trim() : ''
        if (!name || name.length > 40) throw new ApiError(422, 'Folder name must be between 1 and 40 characters')
        if ((await repository.listFolders(clientId)).some((folder) => folder.name.toLowerCase() === name.toLowerCase())) throw new ApiError(409, 'A folder with this name already exists')
        const color = payload.color ?? '#879c85'
        if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new ApiError(422, 'Folder color is invalid')
        return jsonResponse(await repository.createFolder({ id: crypto.randomUUID(), clientId, name, color }), 201)
      }
      const folderMatch = route.match(/^\/folders\/([^/]+)$/)
      if (folderMatch && method === 'DELETE') { const id = decodeURIComponent(folderMatch[1]); if (!await repository.findFolder(clientId, id)) throw new ApiError(404, 'Folder not found'); await repository.deleteFolder(clientId, id); return jsonResponse(null, 204) }

      if (route === '/notes' && method === 'POST') {
        const content = typeof payload.content === 'string' ? payload.content.trim() : ''
        if (!content || content.length > 1000) throw new ApiError(422, 'Reminder must be between 1 and 1000 characters')
        const title = typeof payload.title === 'string' ? payload.title.trim() : ''
        if (title.length > 80) throw new ApiError(422, 'Reminder title must be 80 characters or fewer')
        const color = validateColor(payload.color ?? 'sunflower', ['sunflower', 'sky', 'rose', 'sage'])
        return jsonResponse(await repository.createNote({ id: crypto.randomUUID(), clientId, title, content, color, reminderDate: validateDate(payload.reminder_date) }), 201)
      }
      const noteMatch = route.match(/^\/notes\/([^/]+)$/)
      if (noteMatch) {
        const id = decodeURIComponent(noteMatch[1]); const note = await repository.findNote(clientId, id)
        if (!note) throw new ApiError(404, 'Note not found')
        if (method === 'DELETE') { await repository.deleteNote(clientId, id); return jsonResponse(null, 204) }
        if (method === 'PATCH') {
          const changes = {}
          if ('title' in payload) { if (typeof payload.title !== 'string' || payload.title.length > 80) throw new ApiError(422, 'Reminder title is invalid'); changes.title = payload.title.trim() }
          if ('content' in payload) { if (typeof payload.content !== 'string' || !payload.content.trim() || payload.content.length > 1000) throw new ApiError(422, 'Reminder content is invalid'); changes.content = payload.content.trim() }
          if ('color' in payload) changes.color = validateColor(payload.color, ['sunflower', 'sky', 'rose', 'sage'])
          if ('reminder_date' in payload) changes.reminderDate = validateDate(payload.reminder_date)
          return jsonResponse(Object.keys(changes).length ? await repository.updateNote(clientId, id, changes) : note)
        }
      }
      return jsonResponse({ detail: 'Endpoint not found' }, 404)
    } catch (error) {
      if (error instanceof ApiError) return jsonResponse({ detail: error.message }, error.status)
      console.error('API request failed', error instanceof Error ? error.message : 'Unknown error')
      return jsonResponse({ detail: 'The API could not access task storage' }, 500)
    }
  }
}

export default createApiHandler()
export const config = { path: ['/api', '/api/*'] }
