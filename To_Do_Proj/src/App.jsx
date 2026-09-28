import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlarmClock, ArrowDown, ArrowUpRight, Check, ChevronDown, Circle,
  Clock3, Folder, FolderPlus, LayoutGrid, ListTodo, Menu, MoreHorizontal,
  Plus, Search, Settings2, Sparkles, StickyNote, Trash2,
  X, CheckCircle2,
} from 'lucide-react'

const API = '/api'
const palette = ['#879c85', '#c79775', '#8d9ebc', '#bf8c8b', '#bea56f']
const today = () => new Date().toISOString().slice(0, 10)
const prettyDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.detail || `Request failed (${response.status})`)
  }
  return response.status === 204 ? null : response.json()
}

function App() {
  const [tasks, setTasks] = useState([])
  const [folders, setFolders] = useState([])
  const [notes, setNotes] = useState([])
  const [view, setView] = useState('Today')
  const [activeFolder, setActiveFolder] = useState(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showFolderForm, setShowFolderForm] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [taskData, folderData, noteData] = await Promise.all([
        request('/tasks'), request('/folders'), request('/notes'),
      ])
      setTasks(taskData)
      setFolders(folderData)
      setNotes(noteData)
      setError('')
    } catch (issue) {
      setError(`${issue.message}. Start the FastAPI server to connect Daymark.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const selectedTitle = activeFolder?.name || view
  const visibleTasks = useMemo(() => tasks.filter((task) => {
    if (activeFolder) return task.folder_id === activeFolder.id
    if (view === 'Today') return task.due_date === today()
    if (view === 'Upcoming') return task.due_date && task.due_date >= today()
    if (view === 'All tasks') return true
    if (view === 'Completed') return task.completed
    return task.due_date === today()
  }).filter((task) => filter === 'all' || (filter === 'done' ? task.completed : !task.completed))
    .filter((task) => task.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.due_date || '').localeCompare(b.due_date || '')),
  [tasks, view, activeFolder, filter, query])

  const remaining = tasks.filter((task) => !task.completed && task.due_date === today()).length
  const completedToday = tasks.filter((task) => task.completed).length
  const chooseView = (name) => { setView(name); setActiveFolder(null); setMobileNav(false) }
  const chooseFolder = (folder) => { setActiveFolder(folder); setView('Folder'); setMobileNav(false) }

  const toggleTask = async (task) => {
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))
    try { await request(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ completed: !task.completed }) }) }
    catch (issue) { setError(issue.message); refresh() }
  }

  const removeTask = async (task) => {
    setTasks((current) => current.filter((item) => item.id !== task.id))
    try { await request(`/tasks/${task.id}`, { method: 'DELETE' }) }
    catch (issue) { setError(issue.message); refresh() }
  }

  const removeNote = async (note) => {
    setNotes((current) => current.filter((item) => item.id !== note.id))
    try { await request(`/notes/${note.id}`, { method: 'DELETE' }) }
    catch (issue) { setError(issue.message); refresh() }
  }

  const addTask = async (form) => {
    await request('/tasks', { method: 'POST', body: JSON.stringify(form) })
    await refresh()
    setShowTaskForm(false)
  }

  const addFolder = async (form) => {
    await request('/folders', { method: 'POST', body: JSON.stringify(form) })
    await refresh()
    setShowFolderForm(false)
  }

  const addNote = async (form) => {
    await request('/notes', { method: 'POST', body: JSON.stringify(form) })
    await refresh()
    setShowNoteForm(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-icon"><Check size={17} strokeWidth={2.4} /></div><span>daymark</span><span className="brand-dot">.</span></div>
        <button className="workspace"><div className="workspace-avatar">S</div><div className="workspace-copy"><strong>Sam’s workspace</strong><span>Personal plan</span></div><ChevronDown size={15} /></button>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <NavItem icon={<LayoutGrid size={17} />} label="Today" count={remaining} active={view === 'Today' && !activeFolder} onClick={() => chooseView('Today')} />
          <NavItem icon={<Clock3 size={17} />} label="Upcoming" active={view === 'Upcoming'} onClick={() => chooseView('Upcoming')} />
          <NavItem icon={<ListTodo size={17} />} label="All tasks" count={tasks.length} active={view === 'All tasks'} onClick={() => chooseView('All tasks')} />
          <NavItem icon={<CheckCircle2 size={17} />} label="Completed" count={completedToday} active={view === 'Completed'} onClick={() => chooseView('Completed')} />
        </nav>
        <div className="folder-heading"><span>YOUR FOLDERS</span><button title="Create folder" onClick={() => setShowFolderForm(true)}><Plus size={16} /></button></div>
        <nav className="folder-nav" aria-label="Task folders">
          {folders.map((folder) => <button className={`folder-link ${activeFolder?.id === folder.id ? 'selected' : ''}`} key={folder.id} onClick={() => chooseFolder(folder)}><span className="folder-color" style={{ background: folder.color }}><Folder size={13} fill="currentColor" /></span><span className="folder-name">{folder.name}</span><span className="folder-count">{tasks.filter((task) => task.folder_id === folder.id && !task.completed).length}</span></button>)}
          {!folders.length && <p className="folder-empty">Your folders will live here.</p>}
          <button className="new-folder-link" onClick={() => setShowFolderForm(true)}><FolderPlus size={15} /> New folder</button>
        </nav>
        <div className="sidebar-bottom"><div className="upgrade-card"><Sparkles size={16} /><strong>A little more room</strong><span>Keep all your good ideas in one place.</span><button onClick={() => setShowNoteForm(true)}>Add a sticky note <ArrowUpRight size={13} /></button></div><button className="profile-button"><div className="profile-avatar">S</div><div><strong>Sam Anderson</strong><span>Free plan</span></div><MoreHorizontal size={18} /></button></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={19} /></button><div className="breadcrumb">My workspace <span>/</span> <strong>{selectedTitle}</strong></div><div className="top-actions"><div className="search-box"><Search size={16} /><input aria-label="Search tasks" placeholder="Search anything..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></div><span className="top-divider" /><button className="icon-button" title="Settings"><Settings2 size={18} /></button><div className="top-avatar">S</div></div></header>

        <div className="content-wrap">
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</div><h1>{activeFolder ? activeFolder.name : view === 'Today' ? 'A fresh start.' : view === 'Upcoming' ? 'Looking ahead.' : view === 'Completed' ? 'Look at you go.' : 'All your tasks.'}</h1><p>{activeFolder ? `Everything you’re keeping in ${activeFolder.name}.` : view === 'Today' ? 'Make a little progress, one thing at a time.' : view === 'Upcoming' ? 'Your next steps, all in one place.' : view === 'Completed' ? 'Every little win deserves a moment.' : 'Everything on your plate, neatly in one place.'}</p></div><button className="primary-button" onClick={() => setShowTaskForm(true)}><Plus size={17} /> New task</button></section>

          {error && <div className="error-banner"><span>{error}</span><button aria-label="Dismiss" onClick={() => setError('')}><X size={16} /></button></div>}

          <section className="summary-grid" aria-label="Task summary"><SummaryCard icon={<ListTodo size={17} />} label="On your list" value={tasks.filter((task) => !task.completed).length} detail="across all folders" tone="sage" /><SummaryCard icon={<AlarmClock size={17} />} label="Due today" value={remaining} detail="little things to finish" tone="peach" /><SummaryCard icon={<CheckCircle2 size={17} />} label="Already done" value={completedToday} detail="and counting" tone="lavender" /></section>

          <div className="dashboard-grid"><section className="tasks-panel"><div className="section-head"><div><div className="section-title-row"><h2>{activeFolder ? activeFolder.name : view === 'Today' ? 'Today’s tasks' : view === 'Upcoming' ? 'Coming up' : view === 'Completed' ? 'Completed tasks' : 'Your tasks'}</h2><span className="task-total">{visibleTasks.length}</span></div><p>A manageable list is a happy list.</p></div><button className="quiet-button" onClick={() => setShowTaskForm(true)}><Plus size={15} /> Add task</button></div>
              <div className="task-filters"><button className={filter === 'all' ? 'filter-active' : ''} onClick={() => setFilter('all')}>Everything</button><button className={filter === 'open' ? 'filter-active' : ''} onClick={() => setFilter('open')}>To do</button><button className={filter === 'done' ? 'filter-active' : ''} onClick={() => setFilter('done')}>Done</button><span className="filter-spacer" /><button className="sort-button"><ArrowDown size={13} /> By date</button></div>
              {loading ? <div className="empty-state"><div className="empty-icon"><Circle size={21} /></div><strong>Getting your space ready...</strong></div> : visibleTasks.length ? <div className="task-list">{visibleTasks.map((task) => <TaskRow key={task.id} task={task} folders={folders} onToggle={toggleTask} onDelete={removeTask} />)}</div> : <div className="empty-state"><div className="empty-icon"><CheckCircle2 size={22} /></div><strong>{query ? 'No matching tasks' : view === 'Today' && !activeFolder ? 'A clear little horizon.' : 'Nothing here just yet.'}</strong><span>{query ? 'Try another search.' : 'Add a task whenever you’re ready.'}</span><button onClick={() => setShowTaskForm(true)}><Plus size={15} /> Add a task</button></div>}
              {visibleTasks.length > 0 && <button className="add-task-row" onClick={() => setShowTaskForm(true)}><Plus size={16} /> Add another task</button>}
            </section>

            <aside className="notes-panel"><div className="notes-head"><div><div className="notes-title"><h2>Little reminders</h2><span className="note-count">{notes.length}</span></div><p>Notes to keep close.</p></div><button className="icon-button add-note-button" title="Add reminder" onClick={() => setShowNoteForm(true)}><Plus size={18} /></button></div>
              {notes.length ? <div className="notes-grid">{notes.map((note, index) => <NoteCard key={note.id} note={note} index={index} onDelete={removeNote} />)}<button className="note-add-card" onClick={() => setShowNoteForm(true)}><span><Plus size={17} /></span>Add a little note</button></div> : <div className="notes-empty"><div className="note-empty-art"><StickyNote size={25} /></div><strong>A note to your future self?</strong><span>Drop a reminder here so it’s easy to find later.</span><button onClick={() => setShowNoteForm(true)}><Plus size={15} /> Write a note</button></div>}
              <div className="gentle-tip"><Sparkles size={15} /><span><strong>A gentle reminder</strong>Little steps still move you forward.</span></div>
            </aside></div>
          <footer className="page-footer"><span>Made for doing things at your own pace.</span><span><span className="footer-leaf">✳</span> Take a breath. You’re doing fine.</span></footer>
        </div>
      </main>

      {(showTaskForm || showFolderForm || showNoteForm) && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && (setShowTaskForm(false), setShowFolderForm(false), setShowNoteForm(false))}>{showTaskForm && <TaskModal folders={folders} initialFolder={activeFolder?.id} onClose={() => setShowTaskForm(false)} onSubmit={addTask} />}{showFolderForm && <FolderModal onClose={() => setShowFolderForm(false)} onSubmit={addFolder} />}{showNoteForm && <NoteModal onClose={() => setShowNoteForm(false)} onSubmit={addNote} />}</div>}
    </div>
  )
}

function NavItem({ icon, label, count, active, onClick }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count > 0 && <span className="nav-count">{count}</span>}</button>
}

function SummaryCard({ icon, label, value, detail, tone }) {
  return <div className={`summary-card ${tone}`}><div className="summary-top"><span>{label}</span><span className="summary-icon">{icon}</span></div><div className="summary-bottom"><strong>{value}</strong><span>{detail}</span></div></div>
}

function TaskRow({ task, folders, onToggle, onDelete }) {
  const folder = folders.find((item) => item.id === task.folder_id)
  const isOverdue = task.due_date && task.due_date < today() && !task.completed
  return <div className={`task-row ${task.completed ? 'task-completed' : ''}`}><button className={`task-check ${task.completed ? 'checked' : ''}`} aria-label={task.completed ? 'Mark as not done' : 'Mark as done'} onClick={() => onToggle(task)}>{task.completed && <Check size={13} strokeWidth={3} />}</button><div className="task-copy"><span className="task-title">{task.title}</span><div className="task-meta">{folder && <span className="task-folder"><span style={{ background: folder.color }} />{folder.name}</span>}{task.due_date && <span className={`task-date ${isOverdue ? 'overdue' : ''}`}><Clock3 size={12} />{isOverdue ? 'Overdue · ' : ''}{prettyDate(task.due_date)}</span>}</div></div><span className={`priority-dot priority-${task.priority}`} title={`${task.priority} priority`} /><button className="task-delete" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}><Trash2 size={15} /></button></div>
}

function NoteCard({ note, index, onDelete }) {
  const colors = { sunflower: 'note-yellow', sky: 'note-blue', rose: 'note-pink', sage: 'note-green' }
  return <article className={`note-card ${colors[note.color] || 'note-yellow'} note-tilt-${index % 3}`}><div className="note-top"><span>{note.title || 'A little reminder'}</span><button title="Delete note" onClick={() => onDelete(note)}><X size={14} /></button></div><p>{note.content}</p>{note.reminder_date && <div className="note-reminder"><AlarmClock size={12} />{prettyDate(note.reminder_date)}</div>}<span className="note-tape" /></article>
}

function ModalFrame({ title, subtitle, children, onClose, onSubmit, submitLabel }) {
  return <form className="modal-card" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSubmit(form) }}><div className="modal-header"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}<div className="modal-actions"><button type="button" className="quiet-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{submitLabel}</button></div></form>
}

function TaskModal({ folders, initialFolder, onClose, onSubmit }) {
  const [busy, setBusy] = useState(false)
  const submit = async (form) => { setBusy(true); try { await onSubmit({ title: form.get('title'), folder_id: form.get('folder_id') || null, due_date: form.get('due_date') || null, priority: form.get('priority') }) } catch (error) { window.alert(error.message) } finally { setBusy(false) } }
  return <ModalFrame title="Add a task" subtitle="One small step is still a step." onClose={onClose} onSubmit={submit} submitLabel={busy ? 'Adding…' : 'Add task'}><label className="form-label">What needs doing?<input name="title" autoFocus required maxLength="160" placeholder="e.g. Send the project update" /></label><div className="form-row"><label className="form-label">Folder<select name="folder_id" defaultValue={initialFolder || ''}><option value="">No folder</option>{folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label><label className="form-label">Due date<input name="due_date" type="date" defaultValue={today()} /></label></div><label className="form-label">Priority<select name="priority" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></ModalFrame>
}

function FolderModal({ onClose, onSubmit }) {
  const [color, setColor] = useState(palette[0])
  const [busy, setBusy] = useState(false)
  const submit = async (form) => { setBusy(true); try { await onSubmit({ name: form.get('name'), color }) } catch (error) { window.alert(error.message) } finally { setBusy(false) } }
  return <ModalFrame title="Create a folder" subtitle="Give a group of tasks a home." onClose={onClose} onSubmit={submit} submitLabel={busy ? 'Creating…' : 'Create folder'}><label className="form-label">Folder name<input name="name" autoFocus required maxLength="40" placeholder="e.g. Work, Home, Side project" /></label><fieldset className="color-picker"><legend>Choose a color</legend>{palette.map((swatch) => <button type="button" key={swatch} aria-label={`Select ${swatch}`} className={color === swatch ? 'color-selected' : ''} style={{ '--swatch': swatch }} onClick={() => setColor(swatch)}>{color === swatch && <Check size={13} />}</button>)}</fieldset></ModalFrame>
}

function NoteModal({ onClose, onSubmit }) {
  const [busy, setBusy] = useState(false)
  const submit = async (form) => { setBusy(true); try { await onSubmit({ title: form.get('title'), content: form.get('content'), color: form.get('color'), reminder_date: form.get('reminder_date') || null }) } catch (error) { window.alert(error.message) } finally { setBusy(false) } }
  return <ModalFrame title="Write a little note" subtitle="A kind nudge, a bright idea, anything." onClose={onClose} onSubmit={submit} submitLabel={busy ? 'Saving…' : 'Save note'}><label className="form-label">Title <span className="optional-label">(optional)</span><input name="title" autoFocus maxLength="80" placeholder="e.g. Don’t forget" /></label><label className="form-label">Your note<textarea name="content" required maxLength="1000" rows="4" placeholder="Write a reminder to your future self…" /></label><div className="form-row"><label className="form-label">Note color<select name="color"><option value="sunflower">Sunflower</option><option value="sky">Sky blue</option><option value="rose">Rose</option><option value="sage">Sage</option></select></label><label className="form-label">Remind me<input name="reminder_date" type="date" /></label></div></ModalFrame>
}

export default App
