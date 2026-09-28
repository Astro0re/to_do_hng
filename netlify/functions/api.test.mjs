import assert from 'node:assert/strict'
import test from 'node:test'

import { createApiHandler } from './api.mjs'

function setup() {
  const state = new Map()
  const handler = createApiHandler(() => ({
    async get(key) { return state.has(key) ? JSON.parse(state.get(key)) : null },
    async set(key, value) { state.set(key, value) },
  }))
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

  const handler = createApiHandler(() => ({ get: async () => null, set: async () => {} }))
  const otherClient = await handler(new Request('https://example.test/api/tasks'))
  assert.equal(otherClient.status, 400)
})
