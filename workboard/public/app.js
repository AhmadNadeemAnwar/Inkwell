// The page. All the rules about the file live in board.js; this draws the board, turns clicks into
// changes, and saves the whole file after each one.

import {
  MAX_ITEM_LENGTH, STATUSES, addItem, canMoveOpen, cleanText, inline, isFinished, isUrgent, moveOpenItem, noteText, parse,
  serialize, setUrgent, updateItem,
} from './board.js'

const HINTS = {
  1: 'Rules Claude follows on every job.',
  2: 'Jobs for Claude to do. Add “urgent” to put one first.',
  3: 'Ideas you want an opinion on. Claude gives feedback here and does not build them.',
  4: 'Open items Claude already knows about. Change a status to tell Claude what you decided.',
  5: 'What happened and when. Claude writes this.',
}
/** Claude keeps these two sections; you can still change a status in section 4. */
const NO_ADDING = new Set(['4', '5'])
const RULES = '1'
const LOG = '5'
const POLL_MS = 4000
const TAB_KEY = 'workboard-tab'

function savedTab() {
  try { return localStorage.getItem(TAB_KEY) } catch { return null }
}

const state = {
  doc: null,
  version: null,
  editing: null,
  tab: savedTab(),
  drafts: {},
  openFinished: new Set(),
  saving: false,
  queued: false,
  failed: false,
}

const board = document.getElementById('board')
const notice = document.getElementById('notice')
const saveLabel = document.getElementById('save')

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue
    if (key === 'class') node.className = value
    else if (key === 'text') node.textContent = value
    else if (key === 'on') for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler)
    else if (key in node && key !== 'list') node[key] = value
    else node.setAttribute(key, value === true ? '' : value)
  }
  for (const child of [].concat(children)) if (child) node.append(child)
  return node
}

/** The file's text is never treated as HTML: each piece becomes a text node inside a plain element. */
function formatted(text) {
  return inline(text).map((part) =>
    part.kind === 'text' ? document.createTextNode(part.value)
      : el(part.kind === 'bold' ? 'strong' : part.kind === 'code' ? 'code' : 'em', { text: part.value }))
}

// ---- Loading and saving -------------------------------------------------------------------------

async function request(method, body) {
  const response = await fetch('/api/board', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, body: await response.json() }
}

function showNotice(text) {
  notice.replaceChildren()
  notice.hidden = !text
  if (!text) return
  notice.append(el('span', { text }), el('button', { type: 'button', class: 'button button--quiet', text: 'OK', on: { click: () => showNotice('') } }))
}

function showSave() {
  saveLabel.className = `save${state.failed ? ' save--failed' : ''}`
  saveLabel.textContent = state.failed ? 'Not saved' : state.saving || state.queued ? 'Saving…' : 'Saved to the file'
}

async function load() {
  try {
    const { status, body } = await request('GET')
    if (status !== 200) throw new Error(body.error)
    state.doc = parse(body.content)
    state.version = body.version
    document.getElementById('file').textContent = body.file
    render()
    showSave()
  } catch (error) {
    board.replaceChildren(el('p', { class: 'muted', text: error?.message || 'The workboard could not be loaded. Is its window still open?' }))
  }
}

/** Applies a change to the board and writes the file. A null or unchanged document is ignored. */
function change(next) {
  if (!next || next === state.doc) return
  state.doc = next
  render()
  save()
}

async function save() {
  if (state.saving) {
    state.queued = true
    return
  }
  state.saving = true
  state.queued = false
  showSave()

  try {
    const { status, body } = await request('PUT', { content: serialize(state.doc), baseVersion: state.version })
    if (status === 200) {
      state.version = body.version
      state.failed = false
    } else if (status === 409) {
      // The file moved on underneath us. Never overwrite it: show what is there now.
      state.doc = parse(body.content)
      state.version = body.version
      state.queued = false
      state.editing = null
      state.failed = false
      render()
      showNotice('The file was changed somewhere else a moment ago (probably by Claude), so your last change was not saved. The board now shows the latest file. Please make that change again.')
    } else {
      throw new Error(body.error)
    }
  } catch (error) {
    state.failed = true
    state.queued = false
    showNotice(`Your last change is not saved yet. ${error?.message || 'The workboard is not answering. Is its window still open?'} It will be tried again with your next change.`)
  }

  state.saving = false
  showSave()
  if (state.queued) save()
}

/** Picks up changes Claude (or a text editor) made to the file while the page is open. */
async function poll() {
  if (state.saving || state.queued || state.failed || state.editing !== null || document.visibilityState !== 'visible' || !state.doc) return
  try {
    const { status, body } = await request('GET')
    if (status !== 200 || body.version === state.version || state.saving || state.editing !== null) return
    state.doc = parse(body.content)
    state.version = body.version
    render()
  } catch {
    // The next change will report it if the server has really gone.
  }
}

// ---- Drawing ------------------------------------------------------------------------------------

/** Groups the file's blocks for display: each section's items under the "…:" lead-in they follow. */
function layout(doc) {
  const result = []
  let section = null
  let group = null

  for (const block of doc.blocks) {
    if (block.type === 'heading') {
      group = { label: '', sub: '', items: [] }
      section = { id: block.section.id, title: block.section.title, groups: [group], log: [] }
      result.push(section)
    } else if (!section) {
      continue
    } else if (block.type === 'item') {
      if (block.text !== '') group.items.push(block)
    } else {
      if (section.id === LOG) section.log.push(...block.lines.filter((l) => /^- \S/.test(l)).map((l) => l.slice(2)))
      const lines = block.lines.map((l) => l.trim()).filter((l) => l !== '' && l !== '---')
      const at = lines.findLastIndex((l) => l.endsWith(':') && !l.startsWith('Example'))
      if (at >= 0) {
        group = { label: lines[at].slice(0, -1), sub: lines.slice(at + 1).join(' '), items: [] }
        section.groups.push(group)
      }
    }
  }
  return result
}

function render() {
  // Redrawing replaces every element, so remember where the keyboard was and put it back.
  const active = document.activeElement
  const focusKey = active?.dataset?.key
  const caret = focusKey && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null

  const sections = layout(state.doc)
  if (!sections.some((s) => s.id === state.tab)) state.tab = sections[0]?.id ?? null
  const current = sections.find((s) => s.id === state.tab)
  board.replaceChildren(renderTabs(sections), ...(current ? [renderSection(current)] : []))

  if (focusKey) {
    const again = board.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)
    if (again && !again.disabled) {
      again.focus()
      if (caret && 'setSelectionRange' in again) again.setSelectionRange(...caret)
    }
  }
}

function openCount(section) {
  const items = section.groups.flatMap((g) => g.items)
  return section.id === RULES ? items.length : items.filter((i) => !isFinished(i.status)).length
}

function renderTabs(sections) {
  return el('nav', { class: 'tabs', 'aria-label': 'Sections' }, sections.map((s) => el('button', {
    type: 'button',
    class: `tab${s.id === state.tab ? ' tab--on' : ''}`,
    'aria-current': s.id === state.tab ? 'page' : false,
    'data-key': `tab-${s.id}`,
    on: {
      click: () => {
        state.tab = s.id
        state.editing = null
        try { localStorage.setItem(TAB_KEY, s.id) } catch { /* the tab just isn't remembered */ }
        render()
      },
    },
  }, [
    el('span', { text: s.title }),
    s.id !== LOG && el('span', { class: 'tab__count', text: String(openCount(s)) }),
  ])))
}

function renderSection(section) {
  const all = section.groups.flatMap((g) => g.items)
  // A rule stays in force however it is marked, so the rules are never folded away.
  const isRules = section.id === RULES
  const open = all.filter((i) => isRules || !isFinished(i.status))
  const finished = all.filter((i) => !isRules && isFinished(i.status))
  const isLog = section.id === LOG

  const children = [
    el('div', { class: 'section__head' }, [
      el('h2', {}, [el('span', { class: 'section__number', text: /^\d+$/.test(section.id) ? section.id : '' }), document.createTextNode(section.title)]),
      !isLog && el('span', { class: 'count', text: isRules ? `${open.length} in force` : `${open.length} open` }),
    ]),
    HINTS[section.id] && el('p', { class: 'section__hint', text: HINTS[section.id] }),
  ]

  if (!NO_ADDING.has(section.id)) children.push(renderAddForm(section))

  if (isLog) {
    children.push(section.log.length > 0
      ? el('ul', { class: 'log' }, section.log.map((line) => el('li', {}, formatted(line))))
      : el('p', { class: 'muted', text: 'Nothing logged yet.' }))
  } else {
    for (const group of section.groups) {
      const items = group.items.filter((i) => open.includes(i))
      if (items.length === 0) continue
      if (group.label) children.push(el('h3', { class: 'group' }, [...formatted(group.label), group.sub && el('span', { class: 'group__sub' }, formatted(` ${group.sub}`))]))
      children.push(el('ul', { class: 'items' }, items.map(renderItem)))
    }
    if (open.length === 0) children.push(el('p', { class: 'muted', text: finished.length > 0 ? 'Nothing open here.' : 'Nothing here yet.' }))

    if (finished.length > 0) {
      children.push(el('details', {
        class: 'finished',
        open: state.openFinished.has(section.id),
        on: { toggle: (event) => (event.target.open ? state.openFinished.add(section.id) : state.openFinished.delete(section.id)) },
      }, [
        el('summary', { text: `Finished (${finished.length})`, 'data-key': `finished-${section.id}` }),
        el('ul', { class: 'items' }, finished.map(renderItem)),
      ]))
    }
  }

  return el('section', { class: 'section', 'aria-label': section.title }, children)
}

function renderAddForm(section) {
  const input = el('input', {
    type: 'text',
    class: 'input',
    maxLength: MAX_ITEM_LENGTH,
    value: state.drafts[section.id] ?? '',
    placeholder: section.id === '3' ? 'Write an idea…' : section.id === '1' ? 'Write a rule…' : 'Write something to do…',
    'aria-label': `Add to ${section.title}`,
    'data-key': `add-${section.id}`,
    on: { input: (event) => (state.drafts[section.id] = event.target.value) },
  })

  return el('form', {
    class: 'add',
    on: {
      submit: (event) => {
        event.preventDefault()
        const next = addItem(state.doc, section.id, input.value)
        if (!next) return input.focus()
        state.drafts[section.id] = ''
        input.value = ''
        change(next)
      },
    },
  }, [input, el('button', { type: 'submit', class: 'button button--primary', text: 'Add' })])
}

function renderItem(item) {
  const urgent = isUrgent(item.text)
  const shown = setUrgent(item.text, false)
  const finished = isFinished(item.status)
  const key = (name) => `${name}-${item.id}`

  const check = el('input', {
    type: 'checkbox',
    class: 'check',
    checked: item.status === 'done',
    'aria-label': `Done: ${shown}`,
    'data-key': key('check'),
    on: { change: (event) => change(updateItem(state.doc, item.id, { status: event.target.checked ? 'done' : 'todo' })) },
  })

  const body = state.editing === item.id
    ? renderEditor(item, shown, urgent)
    : el('div', { class: 'item__body' }, [
        el('p', { class: 'item__text' }, [...formatted(shown), urgent && el('span', { class: 'tag tag--urgent', text: 'Urgent' })]),
        item.notes.length > 0 && el('div', { class: 'notes' }, [
          el('p', { class: 'notes__label', text: 'Claude’s notes' }),
          ...item.notes.map((line) => el('p', { class: 'notes__line' }, formatted(noteText(line)))),
        ]),
      ])

  const status = el('select', {
    class: `status status--${item.status}`,
    'aria-label': `Status of: ${shown}`,
    'data-key': key('status'),
    on: { change: (event) => change(updateItem(state.doc, item.id, { status: event.target.value })) },
  }, STATUSES.map((s) => el('option', { value: s.id, text: s.label, selected: s.id === item.status })))

  const tools = el('div', { class: 'item__tools' }, [
    status,
    el('button', {
      type: 'button', class: 'icon', text: 'Edit', 'data-key': key('edit'),
      on: { click: () => { state.editing = item.id; render(); board.querySelector(`[data-key="${key('text')}"]`)?.focus() } },
    }),
    !finished && el('button', {
      type: 'button', class: `icon${urgent ? ' icon--on' : ''}`, text: urgent ? 'Urgent ✓' : 'Urgent', 'aria-pressed': String(urgent), 'data-key': key('urgent'),
      on: { click: () => change(updateItem(state.doc, item.id, { text: setUrgent(item.text, !urgent) })) },
    }),
    !finished && el('button', {
      type: 'button', class: 'icon icon--arrow', text: '↑', title: 'Move up', 'aria-label': `Move up: ${shown}`, 'data-key': key('up'),
      disabled: !canMoveOpen(state.doc, item.id, -1),
      on: { click: () => change(moveOpenItem(state.doc, item.id, -1)) },
    }),
    !finished && el('button', {
      type: 'button', class: 'icon icon--arrow', text: '↓', title: 'Move down', 'aria-label': `Move down: ${shown}`, 'data-key': key('down'),
      disabled: !canMoveOpen(state.doc, item.id, 1),
      on: { click: () => change(moveOpenItem(state.doc, item.id, 1)) },
    }),
  ])

  return el('li', { class: `item item--${item.status}` }, [check, body, tools])
}

function renderEditor(item, shown, urgent) {
  const area = el('textarea', { class: 'input input--area', rows: 3, maxLength: MAX_ITEM_LENGTH, value: shown, 'aria-label': 'Wording', 'data-key': `text-${item.id}` })

  const stop = () => { state.editing = null; render() }
  const keep = () => {
    const text = cleanText(area.value)
    if (text === '') return area.focus()
    state.editing = null
    const next = updateItem(state.doc, item.id, { text: setUrgent(text, urgent) })
    if (next && serialize(next) !== serialize(state.doc)) change(next)
    else render()
  }

  area.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); keep() }
    if (event.key === 'Escape') stop()
  })

  return el('div', { class: 'item__body' }, [
    area,
    el('div', { class: 'edit__actions' }, [
      el('button', { type: 'button', class: 'button button--primary', text: 'Save', on: { click: keep } }),
      el('button', { type: 'button', class: 'button', text: 'Cancel', on: { click: stop } }),
      el('span', { class: 'muted', text: 'Enter saves, Esc cancels.' }),
    ]),
  ])
}

// ---- Start --------------------------------------------------------------------------------------

document.getElementById('copy').addEventListener('click', async (event) => {
  const button = event.currentTarget
  const label = button.textContent
  try {
    await navigator.clipboard.writeText('read the workboard')
    button.textContent = 'Copied. Paste it in the chat'
  } catch {
    button.textContent = 'Type: read the workboard'
  }
  setTimeout(() => (button.textContent = label), 2500)
})

const themeButton = document.getElementById('theme')
function currentTheme() {
  return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}
function showTheme() {
  themeButton.textContent = currentTheme() === 'dark' ? '☀ Light' : '🌙 Dark'
}
themeButton.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  try { localStorage.setItem('workboard-theme', next) } catch { /* the choice just isn't remembered */ }
  showTheme()
})
showTheme()

setInterval(poll, POLL_MS)
document.addEventListener('visibilitychange', poll)
load()
