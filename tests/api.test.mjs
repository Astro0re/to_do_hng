import assert from 'node:assert/strict'
import test from 'node:test'

import { createApiHandler } from '../netlify/functions/api.mjs'

function setup() {
  const state = { tasks: [], folders: [], notes: [] }
  const repository = {
    listTasks: async (clientId, folderId) => state.tasks.filter((item) => item.clientId === clientId && (!folderId || item.folderId === folderId)),
    listFolders: async (clientId) => state.folders.filter((item) => item.clientId === clientId),
    listNotes: async (clientId) => state.notes.filter((item) => item.clientId === clientId),
    findTask: async (clientId, id) => state.tasks.find((item) => item.clientId === clientId && item.id === id),
    findFolder: async (clientId, id) => state.folders.find((item) => item.clientId === clientId && item.id === id),
    findNote: async (clientId, id) => state.notes.find((item) => item.clientId === clientId && item.id === id),
    createTask: async (value) => (state.tasks.push(value), value),
    createFolder: async (value) => (state.folders.push(value), value),
    createNote: async (value) => (state.notes.unshift(value), value),
    updateTask: async (clientId, id, value) => Object.assign(state.tasks.find((item) => item.clientId === clientId && item.id === id), value),
    updateNote: async (clientId, id, value) => Object.assign(state.notes.find((item) => item.clientId === clientId && item.id === id), value),
    deleteTask: async (clientId, id) => { state.tasks = state.tasks.filter((item) => item.clientId !== clientId || item.id !== id) },
    deleteFolder: async (clientId, id) => {
      state.folders = state.folders.filter((item) => item.clientId !== clientId || item.id !== id)
      state.tasks = state.tasks.map((item) => item.folderId === id ? { ...item, folderId: null } : item)
    },
    deleteNote: async (clientId, id) => { state.notes = state.notes.filter((item) => item.clientId !== clientId || item.id !== id) },
  }
  const handler = createApiHandler(() => repository)
  const headers = { 'Content-Type': 'application/json', 'X-User-ID': '6ba7b810-9dad-41d1-80b4-00c04fd430c8' }
  const request = (path, method = 'GET', body) => handler(new Request(`https://example.test/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
  return { request }
}

test('health endpoint works without client storage', async () => {
  const handler = createApiHandler(() => { throw new Error('storage should not be needed for health') })
  const response = await handler(new Request('https://example.test/api/health'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('creates, lists, completes, and deletes a task', async () => {
  const { request } = setup()
  const created = await request('/tasks', 'POST', { title: 'Write tests', priority: 'high' })
  assert.equal(created.status, 201)
  const task = await created.json()
  assert.equal(task.title, 'Write tests')

  const listed = await request('/tasks')
  assert.equal((await listed.json()).length, 1)
  const completed = await request(`/tasks/${task.id}`, 'PATCH', { completed: true })
  assert.equal((await completed.json()).completed, true)
  assert.equal((await request(`/tasks/${task.id}`, 'DELETE')).status, 204)
  assert.deepEqual(await (await request('/tasks')).json(), [])
})

test('folders classify tasks and deleting a folder unassigns them', async () => {
  const { request } = setup()
  const folderResponse = await request('/folders', 'POST', { name: 'Work' })
  const folder = await folderResponse.json()
  const taskResponse = await request('/tasks', 'POST', { title: 'Send update', folder_id: folder.id })
  const task = await taskResponse.json()
  assert.equal(task.folder_id, folder.id)

  assert.equal((await request(`/folders/${folder.id}`, 'DELETE')).status, 204)
  assert.equal((await (await request('/tasks')).json())[0].folder_id, null)
})

test('creates, lists, and deletes a reminder', async () => {
  const { request } = setup()
  const created = await request('/notes', 'POST', {
    content: 'Pick up groceries', color: 'sage', reminder_date: '2026-09-30',
  })
  assert.equal(created.status, 201)
  const note = await created.json()
  assert.equal(note.reminder_date, '2026-09-30')
  assert.equal((await (await request('/notes')).json()).length, 1)
  assert.equal((await request(`/notes/${note.id}`, 'DELETE')).status, 204)
  assert.deepEqual(await (await request('/notes')).json(), [])
})

test('keeps each browser client data separate and rejects invalid input', async () => {
  const { request } = setup()
  const response = await request('/tasks', 'POST', { title: '   ' })
  assert.equal(response.status, 422)

  const handler = createApiHandler(() => { throw new Error('repository should not be used') })
  const otherClient = await handler(new Request('https://example.test/api/tasks'))
  assert.equal(otherClient.status, 400)
})
