// The workboard's local server. It does two things: hands the page its files, and reads and
// writes one Markdown file. It listens on this computer only and needs nothing installed but Node.
//
//   node workboard/server.mjs            serves ../WORKBOARD.md on http://localhost:5190
//   WORKBOARD_FILE=... WORKBOARD_PORT=... to point it elsewhere (the tests do)

import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(here, 'public')

/** The file is small text. Anything larger is not a workboard and is refused rather than written. */
const MAX_BYTES = 1024 * 1024

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
}

/** Identifies one exact state of the file, so a save can tell whether the file changed underneath it. */
export const versionOf = (content) => createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16)

const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  // The page loads only its own files and talks only to this server.
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
}

function send(response, status, body, type = 'application/json; charset=utf-8') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  response.writeHead(status, { ...HEADERS, 'Content-Type': type, 'Content-Length': Buffer.byteLength(payload) })
  response.end(payload)
}

/**
 * Any website open in the browser can send requests to localhost. Two checks stop one from reading
 * or rewriting the file: the request must be addressed to this server by a local name (which
 * defeats a hostile domain pointed at 127.0.0.1), and if the browser says which page sent it, that
 * page must be this one.
 */
export function isLocalRequest(headers, port) {
  const allowed = [`localhost:${port}`, `127.0.0.1:${port}`]
  if (!allowed.includes(String(headers.host ?? '').toLowerCase())) return false

  const origin = headers.origin
  if (origin === undefined) return true
  return allowed.some((host) => origin === `http://${host}`)
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BYTES * 2) throw Object.assign(new Error('too large'), { status: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export function createWorkboardServer({ file, port }) {
  const target = resolve(file)

  async function current() {
    const content = await readFile(target, 'utf8')
    return { content, version: versionOf(content) }
  }

  return createServer(async (request, response) => {
    try {
      if (!isLocalRequest(request.headers, port)) return send(response, 403, { error: 'This workboard only answers the computer it runs on.' })

      const url = new URL(request.url, `http://localhost:${port}`)

      if (url.pathname === '/api/board') {
        if (request.method === 'GET') return send(response, 200, { ...(await current()), file: target })

        if (request.method === 'PUT') {
          // Only a script on this page can send JSON here; a plain form on another site cannot.
          if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json'))
            return send(response, 415, { error: 'Send the board as JSON.' })

          let body
          try {
            body = JSON.parse(await readBody(request))
          } catch (error) {
            return send(response, error.status ?? 400, { error: 'That was not a readable request.' })
          }

          if (typeof body?.content !== 'string' || typeof body?.baseVersion !== 'string')
            return send(response, 400, { error: 'A save needs the new content and the version it was based on.' })
          if (Buffer.byteLength(body.content, 'utf8') > MAX_BYTES)
            return send(response, 413, { error: 'That is too large to be a workboard.' })
          if (body.content.trim() === '')
            return send(response, 400, { error: 'Refusing to replace the workboard with an empty file.' })

          const before = await current()
          if (before.version !== body.baseVersion) {
            // Someone else (Claude, or you in an editor) changed the file since this page loaded it.
            return send(response, 409, { error: 'The workboard file changed since this page loaded it.', ...before })
          }

          // Written beside the real file and then swapped in, so a crash cannot leave half a file.
          const temporary = `${target}.saving`
          await writeFile(temporary, body.content, 'utf8')
          await rename(temporary, target)
          return send(response, 200, await current())
        }

        return send(response, 405, { error: 'Use GET to read the board and PUT to save it.' })
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, { error: 'Not allowed.' })

      const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const path = normalize(join(PUBLIC, relative))
      // Nothing outside the public folder is ever served, whatever the address says.
      if (path !== PUBLIC && !path.startsWith(PUBLIC + sep)) return send(response, 404, 'Not found\n', 'text/plain; charset=utf-8')

      const type = TYPES[extname(path)]
      if (!type) return send(response, 404, 'Not found\n', 'text/plain; charset=utf-8')

      try {
        return send(response, 200, await readFile(path, 'utf8'), type)
      } catch {
        return send(response, 404, 'Not found\n', 'text/plain; charset=utf-8')
      }
    } catch (error) {
      const missing = error?.code === 'ENOENT'
      return send(response, missing ? 404 : 500, { error: missing ? 'The workboard file could not be found.' : 'Something went wrong reading or saving the workboard.' })
    }
  })
}

// Started directly (not imported by a test): serve the real file.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.WORKBOARD_PORT ?? process.env.PORT ?? 5190)
  const file = process.env.WORKBOARD_FILE ?? join(here, '..', 'WORKBOARD.md')

  const server = createWorkboardServer({ file, port })
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE'
      ? `The workboard is already running. Open http://localhost:${port} in your browser.`
      : `The workboard could not start: ${error.message}`)
    process.exit(error.code === 'EADDRINUSE' ? 0 : 1)
  })
  server.listen(port, '127.0.0.1', () => {
    console.log(`Workboard: http://localhost:${port}`)
    console.log(`Editing:   ${resolve(file)}`)
    console.log('Leave this window open while you use it. Close it to stop.')
  })
}
