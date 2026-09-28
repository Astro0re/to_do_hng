import { getStore } from '@netlify/blobs'

const emptyState = () => ({ tasks: [], folders: [], notes: [] })
const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(payload === null ? null : JSON.stringify(payload), {
    status,
    headers: payload === null ? undefined : { 'Content-Type': 'application/json' },
  })
}

function validateDate(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(422, 'Date must use YYYY-MM-DD format')
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(422, 'Date is invalid')
  }
  return value
}

function validateColor(value, allowed) {
  if (!allowed.includes(value)) throw new ApiError(422, 'Color is invalid')
  return value
}

export function createApiHandler(getStorage = getStore) {
  return async function handleApiRequest(request) {
    const url = new URL(request.url)
    const route = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
    const method = request.method.toUpperCase()

    if (route === '/health' && method === 'GET') return jsonResponse({ status: 'ok' })
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
      return jsonResponse({ detail: 'Method not allowed' }, 405)
    }

    const userId = request.headers.get('x-user-id') || ''
    if (!userIdPattern.test(userId)) return jsonResponse({ detail: 'A valid client ID is required' }, 400)

    const store = getStorage({ name: 'daymark-todo', consistency: 'strong' })
    const storageKey = `client:${userId}`
    let data
    try {
      data = await store.get(storageKey, { type: 'json' }) || emptyState()
    } catch {
      return jsonResponse({ detail: 'Could not read deployed task storage' }, 500)
    }

    async function save() {
      try {
        await store.set(storageKey, JSON.stringify(data))
      } catch {
        throw new ApiError(500, 'Could not save task data to deployed storage')
      }
    }

    try {
      if (route === '/tasks' && method === 'GET') {
        const folderId = url.searchParams.get('folder_id')
        return jsonResponse(folderId ? data.tasks.filter((task) => task.folder_id === folderId) : data.tasks)
      }

      if (route === '/folders' && method === 'GET') return jsonResponse(data.folders)
      if (route === '/notes' && method === 'GET') return jsonResponse(data.notes)

      let payload = null
      if (method === 'POST' || method === 'PATCH') {
        try {
          payload = await request.json()
        } catch {
          throw new ApiError(400, 'Request body must be valid JSON')
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new ApiError(422, 'Request body must be an object')
        }
      }

      if (route === '/tasks' && method === 'POST') {
        const title = typeof payload.title === 'string' ? payload.title.trim() : ''
        if (!title || title.length > 160) throw new ApiError(422, 'Title must be between 1 and 160 characters')
        const priority = payload.priority ?? 'medium'
        if (!['low', 'medium', 'high'].includes(priority)) throw new ApiError(422, 'Priority is invalid')
        const folderId = payload.folder_id || null
        if (folderId && !data.folders.some((folder) => folder.id === folderId)) throw new ApiError(404, 'Folder not found')
        const task = {
          id: crypto.randomUUID(), title, folder_id: folderId,
          due_date: validateDate(payload.due_date), priority, completed: false,
          created_at: new Date().toISOString(),
        }
        data.tasks.push(task)
        await save()
        return jsonResponse(task, 201)
      }

      const taskMatch = route.match(/^\/tasks\/([^/]+)$/)
      if (taskMatch) {
        const taskIndex = data.tasks.findIndex((task) => task.id === decodeURIComponent(taskMatch[1]))
        if (taskIndex < 0) throw new ApiError(404, 'Task not found')
        if (method === 'DELETE') {
          data.tasks.splice(taskIndex, 1)
          await save()
          return jsonResponse(null, 204)
        }
        if (method === 'PATCH') {
          const task = data.tasks[taskIndex]
          if ('title' in payload) {
            const title = typeof payload.title === 'string' ? payload.title.trim() : ''
            if (!title || title.length > 160) throw new ApiError(422, 'Title must be between 1 and 160 characters')
            task.title = title
          }
          if ('folder_id' in payload) {
            if (payload.folder_id && !data.folders.some((folder) => folder.id === payload.folder_id)) {
              throw new ApiError(404, 'Folder not found')
            }
            task.folder_id = payload.folder_id || null
          }
          if ('due_date' in payload) task.due_date = validateDate(payload.due_date)
          if ('priority' in payload) {
            if (!['low', 'medium', 'high'].includes(payload.priority)) throw new ApiError(422, 'Priority is invalid')
            task.priority = payload.priority
          }
          if ('completed' in payload) {
            if (typeof payload.completed !== 'boolean') throw new ApiError(422, 'Completed must be true or false')
            task.completed = payload.completed
          }
          await save()
          return jsonResponse(task)
        }
      }

      if (route === '/folders' && method === 'POST') {
        const name = typeof payload.name === 'string' ? payload.name.trim() : ''
        if (!name || name.length > 40) throw new ApiError(422, 'Folder name must be between 1 and 40 characters')
        if (data.folders.some((folder) => folder.name.toLowerCase() === name.toLowerCase())) {
          throw new ApiError(409, 'A folder with this name already exists')
        }
        const color = payload.color ?? '#879c85'
        if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new ApiError(422, 'Folder color is invalid')
        const folder = { id: crypto.randomUUID(), name, color, created_at: new Date().toISOString() }
        data.folders.push(folder)
        await save()
        return jsonResponse(folder, 201)
      }

      const folderMatch = route.match(/^\/folders\/([^/]+)$/)
      if (folderMatch && method === 'DELETE') {
        const folderId = decodeURIComponent(folderMatch[1])
        const index = data.folders.findIndex((folder) => folder.id === folderId)
        if (index < 0) throw new ApiError(404, 'Folder not found')
        data.folders.splice(index, 1)
        data.tasks = data.tasks.map((task) => task.folder_id === folderId ? { ...task, folder_id: null } : task)
        await save()
        return jsonResponse(null, 204)
      }

      if (route === '/notes' && method === 'POST') {
        const content = typeof payload.content === 'string' ? payload.content.trim() : ''
        if (!content || content.length > 1000) throw new ApiError(422, 'Reminder must be between 1 and 1000 characters')
        const title = typeof payload.title === 'string' ? payload.title.trim() : ''
        if (title.length > 80) throw new ApiError(422, 'Reminder title must be 80 characters or fewer')
        const color = validateColor(payload.color ?? 'sunflower', ['sunflower', 'sky', 'rose', 'sage'])
        const note = {
          id: crypto.randomUUID(), title, content, color,
          reminder_date: validateDate(payload.reminder_date), created_at: new Date().toISOString(),
        }
        data.notes.unshift(note)
        await save()
        return jsonResponse(note, 201)
      }

      const noteMatch = route.match(/^\/notes\/([^/]+)$/)
      if (noteMatch) {
        const index = data.notes.findIndex((note) => note.id === decodeURIComponent(noteMatch[1]))
        if (index < 0) throw new ApiError(404, 'Note not found')
        if (method === 'DELETE') {
          data.notes.splice(index, 1)
          await save()
          return jsonResponse(null, 204)
        }
        if (method === 'PATCH') {
          const note = data.notes[index]
          if ('title' in payload) {
            if (typeof payload.title !== 'string' || payload.title.length > 80) throw new ApiError(422, 'Reminder title is invalid')
            note.title = payload.title.trim()
          }
          if ('content' in payload) {
            if (typeof payload.content !== 'string' || !payload.content.trim() || payload.content.length > 1000) {
              throw new ApiError(422, 'Reminder content is invalid')
            }
            note.content = payload.content.trim()
          }
          if ('color' in payload) note.color = validateColor(payload.color, ['sunflower', 'sky', 'rose', 'sage'])
          if ('reminder_date' in payload) note.reminder_date = validateDate(payload.reminder_date)
          await save()
          return jsonResponse(note)
        }
      }

      return jsonResponse({ detail: 'Endpoint not found' }, 404)
    } catch (error) {
      if (error instanceof ApiError) return jsonResponse({ detail: error.message }, error.status)
      return jsonResponse({ detail: 'Unexpected API error' }, 500)
    }
  }
}

export default createApiHandler()

export const config = {
  path: ['/api', '/api/*'],
}
