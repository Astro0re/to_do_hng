import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2, Circle, Folder, Plus, RefreshCw, Search, StickyNote, Trash2, X } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
let memoryClientId

function getClientId() {
  const key = 'daymark-client-id'
  try {
    let id = window.localStorage.getItem(key)
    if (!id) {
      id = window.crypto.randomUUID()
      window.localStorage.setItem(key, id)
    }
    return id
  } catch {
    memoryClientId ||= window.crypto.randomUUID()
    return memoryClientId
  }
}

const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-User-ID': getClientId(), ...options.headers },
    })
  } catch {
    throw new Error(`Can't reach ${API_BASE}. Check that the Netlify Function is deployed and that VITE_API_BASE_URL is unset or points to this site's API.`)
  }

  const body = await response.text()
  let result = null
  try { result = body ? JSON.parse(body) : null } catch { result = null }
  if (!response.ok) {
    const detail = result?.detail
    const message = Array.isArray(detail)
      ? detail.map((item) => `${item.loc?.at(-1) || 'field'}: ${item.msg}`).join(', ')
      : detail
    throw new Error(message || `API request failed (${response.status})`)
  }
  return result
}

function App() {
  const [tasks, setTasks] = useState([])
  const [folders, setFolders] = useState([])
  const [notes, setNotes] = useState([])
  const [view, setView] = useState('today')
  const [folderId, setFolderId] = useState('')
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [taskFolder, setTaskFolder] = useState('')
  const [folderName, setFolderName] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteDate, setNoteDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingTask, setSavingTask] = useState(false)
  const [savingFolder, setSavingFolder] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const [nextTasks, nextFolders, nextNotes] = await Promise.all([
        request('/tasks'), request('/folders'), request('/notes'),
      ])
      setTasks(nextTasks)
      setFolders(nextFolders)
      setNotes(nextNotes)
      setError('')
    } catch (issue) {
      setError(issue.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const shownTasks = useMemo(() => tasks.filter((task) => {
    if (folderId && task.folder_id !== folderId) return false
    if (!folderId && view === 'today' && (task.due_date !== today() || task.completed)) return false
    if (!folderId && view === 'upcoming' && (!task.due_date || task.due_date < today() || task.completed)) return false
    if (!folderId && view === 'completed' && !task.completed) return false
    if (!folderId && view === 'all' && task.completed) return false
    return task.title.toLowerCase().includes(search.trim().toLowerCase())
  }).sort((a, b) => Number(a.completed) - Number(b.completed) || (a.due_date || '').localeCompare(b.due_date || '')),
  [tasks, view, folderId, search])

  async function addTask(event) {
    event.preventDefault()
    if (!title.trim()) return
    setSavingTask(true)
    setError('')
    try {
      const task = await request('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          folder_id: taskFolder || null,
          due_date: dueDate || null,
          priority,
        }),
      })
      setTasks((current) => [...current, task])
      setTitle('')
      setDueDate('')
    } catch (issue) {
      setError(`Task wasn't added: ${issue.message}`)
    } finally {
      setSavingTask(false)
    }
  }

  async function toggleTask(task) {
    const completed = !task.completed
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed } : item))
    try {
      await request(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ completed }) })
    } catch (issue) {
      setError(`Task wasn't updated: ${issue.message}`)
      loadData()
    }
  }

  async function deleteTask(task) {
    setTasks((current) => current.filter((item) => item.id !== task.id))
    try {
      await request(`/tasks/${task.id}`, { method: 'DELETE' })
    } catch (issue) {
      setError(`Task wasn't deleted: ${issue.message}`)
      loadData()
    }
  }

  async function addFolder(event) {
    event.preventDefault()
    if (!folderName.trim()) return
    setSavingFolder(true)
    setError('')
    try {
      const folder = await request('/folders', {
        method: 'POST',
        body: JSON.stringify({ name: folderName.trim() }),
      })
      setFolders((current) => [...current, folder])
      setFolderName('')
      setTaskFolder(folder.id)
    } catch (issue) {
      setError(`Folder wasn't added: ${issue.message}`)
    } finally {
      setSavingFolder(false)
    }
  }

  async function addNote(event) {
    event.preventDefault()
    if (!noteContent.trim()) return
    setSavingNote(true)
    setError('')
    try {
      const note = await request('/notes', {
        method: 'POST',
        body: JSON.stringify({ content: noteContent.trim(), reminder_date: noteDate || null }),
      })
      setNotes((current) => [note, ...current])
      setNoteContent('')
      setNoteDate('')
    } catch (issue) {
      setError(`Reminder wasn't saved: ${issue.message}`)
    } finally {
      setSavingNote(false)
    }
  }

  async function deleteNote(note) {
    setNotes((current) => current.filter((item) => item.id !== note.id))
    try {
      await request(`/notes/${note.id}`, { method: 'DELETE' })
    } catch (issue) {
      setError(`Reminder wasn't deleted: ${issue.message}`)
      loadData()
    }
  }

  const heading = folderId
    ? folders.find((folder) => folder.id === folderId)?.name || 'Folder'
    : ({ today: 'Today', upcoming: 'Upcoming', all: 'To do', completed: 'Completed' }[view])

  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Daymark home"><span className="brand-mark"><Check size={17} /></span> Daymark</a>
        <label className="search"><Search size={17} /><input aria-label="Search tasks" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a task" /></label>
        <button className="refresh" onClick={loadData} title="Refresh tasks"><RefreshCw size={16} /><span>Refresh</span></button>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <p className="side-label">TASKS</p>
          <nav aria-label="Task views">
            <ViewButton active={!folderId && view === 'today'} onClick={() => { setFolderId(''); setTaskFolder(''); setView('today') }} label="Today" count={tasks.filter((task) => !task.completed && task.due_date === today()).length} />
            <ViewButton active={!folderId && view === 'upcoming'} onClick={() => { setFolderId(''); setTaskFolder(''); setView('upcoming') }} label="Upcoming" />
            <ViewButton active={!folderId && view === 'all'} onClick={() => { setFolderId(''); setTaskFolder(''); setView('all') }} label="To do" count={tasks.filter((task) => !task.completed).length} />
            <ViewButton active={!folderId && view === 'completed'} onClick={() => { setFolderId(''); setTaskFolder(''); setView('completed') }} label="Completed" />
          </nav>

          <div className="folder-heading"><p className="side-label">FOLDERS</p></div>
          <nav className="folder-list" aria-label="Task folders">
            {folders.map((folder) => <button className={`folder-button ${folderId === folder.id ? 'selected' : ''}`} key={folder.id} onClick={() => { setFolderId(folder.id); setTaskFolder(folder.id) }}><Folder size={16} /><span>{folder.name}</span><small>{tasks.filter((task) => task.folder_id === folder.id && !task.completed).length}</small></button>)}
            {!folders.length && <p className="muted small">No folders yet.</p>}
          </nav>
          <form className="folder-form" onSubmit={addFolder}><input aria-label="New folder name" value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={40} placeholder="New folder name" /><button aria-label="Add folder" disabled={savingFolder || !folderName.trim()}><Plus size={16} /></button></form>
          <p className="side-hint">Group related tasks into folders.</p>
        </aside>

        <section className="task-area" aria-labelledby="page-title">
          <div className="page-heading"><div><p className="eyebrow">YOUR SPACE</p><h1 id="page-title">{heading}</h1><p className="subtitle">Keep it simple. One task at a time.</p></div><span className="task-count">{shownTasks.length} {shownTasks.length === 1 ? 'task' : 'tasks'}</span></div>
          {error && <div className="error-message" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}

          <form className="add-task-form" onSubmit={addTask}>
            <div className="task-input-wrap"><Plus size={18} /><input aria-label="Task title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="What needs to get done?" required /></div>
            <div className="task-options"><label><span>Folder</span><select aria-label="Task folder" value={taskFolder} onChange={(event) => setTaskFolder(event.target.value)}><option value="">No folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><label><span>Due</span><input aria-label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label><span>Priority</span><select aria-label="Priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Low</option><option value="medium">Normal</option><option value="high">High</option></select></label><button className="add-button" type="submit" disabled={savingTask || !title.trim()}>{savingTask ? 'Adding…' : 'Add task'}</button></div>
          </form>

          <div className="list-heading"><h2>{heading === 'Completed' ? 'Finished' : 'Your list'}</h2><span>{shownTasks.length}</span></div>
          {loading ? <p className="empty-message">Loading tasks…</p> : shownTasks.length ? <ul className="task-list">{shownTasks.map((task) => <TaskItem key={task.id} task={task} folder={folders.find((item) => item.id === task.folder_id)} onToggle={toggleTask} onDelete={deleteTask} />)}</ul> : <div className="empty-state"><CheckCircle2 size={25} /><strong>{search ? 'No matching tasks' : 'Nothing on your list'}</strong><span>Add a task above when you’re ready.</span></div>}

          <section className="reminders" aria-labelledby="reminders-title">
            <div className="reminders-heading"><div><h2 id="reminders-title"><StickyNote size={17} /> Reminders</h2><p>Notes you want to keep handy.</p></div></div>
            <form className="note-form" onSubmit={addNote}><textarea aria-label="Reminder text" value={noteContent} onChange={(event) => setNoteContent(event.target.value)} maxLength={1000} placeholder="Write a quick reminder…" rows={2} required /><div className="note-controls"><label><span>Remind me</span><input aria-label="Reminder date" type="date" value={noteDate} onChange={(event) => setNoteDate(event.target.value)} /></label><button type="submit" disabled={savingNote || !noteContent.trim()}><Plus size={15} />{savingNote ? 'Saving…' : 'Add reminder'}</button></div></form>
            {notes.length > 0 && <ul className="note-list">{notes.map((note) => <li className="note-item" key={note.id}><div><p>{note.content}</p>{note.reminder_date && <time dateTime={note.reminder_date}>{new Date(`${note.reminder_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>}</div><button aria-label="Delete reminder" onClick={() => deleteNote(note)}><Trash2 size={15} /></button></li>)}</ul>}
          </section>
        </section>
      </div>
    </main>
  )
}

function ViewButton({ active, onClick, label, count }) {
  return <button className={`view-button ${active ? 'selected' : ''}`} onClick={onClick}><Circle size={15} /><span>{label}</span>{count > 0 && <small>{count}</small>}</button>
}

function TaskItem({ task, folder, onToggle, onDelete }) {
  return <li className={`task-item ${task.completed ? 'is-complete' : ''}`}>
    <button className="check-task" aria-label={task.completed ? 'Mark task incomplete' : 'Complete task'} onClick={() => onToggle(task)}>{task.completed ? <CheckCircle2 size={19} /> : <Circle size={19} />}</button>
    <div className="task-details"><span className="task-name">{task.title}</span><div className="task-meta">{folder && <span>{folder.name}</span>}{task.due_date && <time dateTime={task.due_date}>{new Date(`${task.due_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>}<span className={`priority priority-${task.priority}`}>{task.priority}</span></div></div>
    <button className="delete-task" aria-label="Delete task" onClick={() => onDelete(task)}><Trash2 size={16} /></button>
  </li>
}

export default App
