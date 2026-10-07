import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { createWorkboardServer, isLocalRequest, versionOf } from './server.mjs'

const ORIGINAL = '# Workboard\n\n## 2. Things to do\n\n- [ ] First\n'

describe('isLocalRequest', () => {
  it('accepts this server addressed by a local name', () => {
    assert.equal(isLocalRequest({ host: 'localhost:5190' }, 5190), true)
    assert.equal(isLocalRequest({ host: '127.0.0.1:5190', origin: 'http://127.0.0.1:5190' }, 5190), true)
    assert.equal(isLocalRequest({ host: 'LOCALHOST:5190', origin: 'http://localhost:5190' }, 5190), true)
  })

  it('refuses a request sent by another website', () => {
    assert.equal(isLocalRequest({ host: 'localhost:5190', origin: 'https://evil.example' }, 5190), false)
    assert.equal(isLocalRequest({ host: 'localhost:5190', origin: 'http://localhost:9999' }, 5190), false)
    assert.equal(isLocalRequest({ host: 'localhost:5190', origin: 'null' }, 5190), false)
  })

  it('refuses a request addressed to it by any other name, which is how a hostile domain would reach it', () => {
    assert.equal(isLocalRequest({ host: 'evil.example:5190' }, 5190), false)
    assert.equal(isLocalRequest({ host: 'localhost:9999' }, 5190), false)
    assert.equal(isLocalRequest({}, 5190), false)
  })
})

describe('the workboard server', () => {
  let directory, file, server, port, base

  const call = (path, options = {}) => fetch(`${base}${path}`, options)
  const save = (content, baseVersion, headers = { 'Content-Type': 'application/json' }) =>
    call('/api/board', { method: 'PUT', headers, body: JSON.stringify({ content, baseVersion }) })

  before(async () => {
    directory = mkdtempSync(join(tmpdir(), 'workboard-'))
    file = join(directory, 'WORKBOARD.md')
    // The port is not known until the server is listening, and the server checks requests against it.
    const probe = createWorkboardServer({ file, port: 0 })
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
    port = probe.address().port
    await new Promise((resolve) => probe.close(resolve))

    server = createWorkboardServer({ file, port })
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))
    base = `http://localhost:${port}`
  })

  after(async () => {
    await new Promise((resolve) => server.close(resolve))
    rmSync(directory, { recursive: true, force: true })
  })

  const reset = () => writeFileSync(file, ORIGINAL, 'utf8')

  it('serves the page and its scripts with a strict content policy', async () => {
    const page = await call('/')
    const script = await call('/board.js')

    assert.equal(page.status, 200)
    assert.match(page.headers.get('content-type'), /text\/html/)
    assert.match(page.headers.get('content-security-policy'), /default-src 'none'/)
    assert.equal(page.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(script.status, 200)
    assert.match(script.headers.get('content-type'), /javascript/)
  })

  it('reads the file and says which version it is', async () => {
    reset()

    const body = await (await call('/api/board')).json()

    assert.equal(body.content, ORIGINAL)
    assert.equal(body.version, versionOf(ORIGINAL))
  })

  it('saves a change made from the version on disk', async () => {
    reset()
    const changed = ORIGINAL.replace('- [ ] First', '- [x] First')

    const response = await save(changed, versionOf(ORIGINAL))

    assert.equal(response.status, 200)
    assert.equal((await response.json()).version, versionOf(changed))
    assert.equal(readFileSync(file, 'utf8'), changed)
  })

  it('refuses to save over a file that changed in the meantime, and hands back what is there now', async () => {
    reset()
    const stale = versionOf(ORIGINAL)
    const theirs = ORIGINAL + '- [ ] Added by Claude\n'
    writeFileSync(file, theirs, 'utf8')

    const response = await save(ORIGINAL.replace('First', 'Mine'), stale)
    const body = await response.json()

    assert.equal(response.status, 409)
    assert.equal(body.content, theirs)
    assert.equal(body.version, versionOf(theirs))
    assert.equal(readFileSync(file, 'utf8'), theirs, 'the other change must survive')
  })

  it('refuses to empty the file', async () => {
    reset()

    assert.equal((await save('   \n', versionOf(ORIGINAL))).status, 400)
    assert.equal(readFileSync(file, 'utf8'), ORIGINAL)
  })

  it('refuses a save that is not JSON, is malformed, or is missing its parts', async () => {
    reset()
    const version = versionOf(ORIGINAL)

    assert.equal((await save('x', version, { 'Content-Type': 'text/plain' })).status, 415)
    assert.equal((await call('/api/board', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{not json' })).status, 400)
    assert.equal((await call('/api/board', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'x' }) })).status, 400)
    assert.equal(readFileSync(file, 'utf8'), ORIGINAL)
  })

  it('refuses something far too large to be a workboard', async () => {
    reset()

    assert.equal((await save('x'.repeat(1024 * 1024 + 1), versionOf(ORIGINAL))).status, 413)
    assert.equal(readFileSync(file, 'utf8'), ORIGINAL)
  })

  it('refuses a request that comes from another website', async () => {
    reset()

    const read = await call('/api/board', { headers: { Origin: 'https://evil.example' } })
    const write = await save('# Pwned\n', versionOf(ORIGINAL), { 'Content-Type': 'application/json', Origin: 'https://evil.example' })

    assert.equal(read.status, 403)
    assert.equal(write.status, 403)
    assert.equal(readFileSync(file, 'utf8'), ORIGINAL)
  })

  it('never serves a file from outside its own folder', async () => {
    for (const path of ['/../server.mjs', '/..%2Fserver.mjs', '/%2e%2e/%2e%2e/WORKBOARD.md', '/server.mjs', '/board.test.mjs']) {
      const response = await call(path)
      assert.equal(response.status, 404, path)
      assert.ok(!(await response.text()).includes('createWorkboardServer'), path)
    }
  })

  it('says so plainly when the workboard file is missing', async () => {
    rmSync(file, { force: true })

    const response = await call('/api/board')

    assert.equal(response.status, 404)
    assert.match((await response.json()).error, /could not be found/)
    reset()
  })

  it('refuses other ways of calling the board address', async () => {
    assert.equal((await call('/api/board', { method: 'DELETE' })).status, 405)
    assert.equal((await call('/', { method: 'POST' })).status, 405)
  })
})
