import type { ReactNode } from 'react'
import { isHttpsUrl, isImageId, isSafeLink, safeHref, storedImageUrl } from '../lib/safeUrl'

interface Mark {
  type: string
  attrs?: Record<string, unknown>
}

interface Node {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Mark[]
  content?: Node[]
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * Renders a stored post body as React elements.
 *
 * A body is either one rich-text document, or a list of sections (text, an uploaded picture, a
 * list of sources). Deliberately does not use dangerouslySetInnerHTML: only the node and mark
 * types listed below are rendered, so a crafted document cannot inject markup or script into a
 * reader's page. Anything unrecognised degrades to its plain text.
 */
export function RichText({ contentJson }: { contentJson: string }) {
  let doc: Node
  try {
    doc = JSON.parse(contentJson)
  } catch {
    return <p className="muted">This post could not be displayed.</p>
  }

  return <div className="prose">{renderChildren(doc?.content)}</div>
}

function renderChildren(nodes: Node[] | undefined): ReactNode {
  if (!Array.isArray(nodes)) return null
  return nodes.map((node, index) => <RenderNode key={index} node={node} />)
}

function RenderNode({ node }: { node: Node }): ReactNode {
  if (typeof node !== 'object' || node === null) return null

  switch (node.type) {
    case 'text':
      return applyMarks(node.text ?? '', node.marks)

    case 'paragraph':
      return <p>{renderChildren(node.content)}</p>

    case 'heading': {
      const level = Number(node.attrs?.level ?? 2)
      const Tag = (level === 1 ? 'h2' : level === 2 ? 'h2' : 'h3') as 'h2' | 'h3'
      // Headings start at h2: the post title already owns the single h1 on the page.
      return <Tag>{renderChildren(node.content)}</Tag>
    }

    case 'blockquote':
      return <blockquote>{renderChildren(node.content)}</blockquote>

    case 'bulletList':
      return <ul>{renderChildren(node.content)}</ul>

    case 'orderedList':
      return <ol>{renderChildren(node.content)}</ol>

    case 'listItem':
      return <li>{renderChildren(node.content)}</li>

    case 'codeBlock':
      return <pre><code>{renderChildren(node.content)}</code></pre>

    case 'horizontalRule':
      return <hr />

    case 'hardBreak':
      return <br />

    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : null
      if (!src || !isHttpsUrl(src)) return null
      return <img src={src} alt={typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''} referrerPolicy="no-referrer" loading="lazy" />
    }

    case 'imageSection': {
      // Only a picture uploaded to this site is shown; the id is checked so it cannot point anywhere else.
      const imageId = text(node.attrs?.imageId)
      if (!isImageId(imageId)) return null
      const caption = text(node.attrs?.caption)
      return (
        <figure className="prose__figure">
          <img src={storedImageUrl(imageId)} alt={text(node.attrs?.alt)} loading="lazy" decoding="async" />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      )
    }

    case 'referencesSection': {
      const raw = Array.isArray(node.attrs?.items) ? (node.attrs.items as unknown[]) : []
      const items = raw
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({ title: text(item.title).trim(), href: safeHref(text(item.url)) }))
        .filter((item) => item.title !== '')
      if (items.length === 0) return null

      return (
        <section className="prose__references" aria-label="References">
          <h2>References</h2>
          <ol>
            {items.map((item, index) => (
              <li key={index}>
                {item.href ? <a href={item.href} target="_blank" rel="noopener noreferrer nofollow">{item.title}</a> : item.title}
              </li>
            ))}
          </ol>
        </section>
      )
    }

    // A text section is only a grouping; its blocks render exactly as they would in a single document.
    default:
      return renderChildren(node.content)
  }
}

function applyMarks(text: string, marks: Mark[] | undefined): ReactNode {
  if (!marks?.length) return text

  return marks.reduce<ReactNode>((node, mark) => {
    switch (mark.type) {
      case 'bold': return <strong>{node}</strong>
      case 'italic': return <em>{node}</em>
      case 'strike': return <s>{node}</s>
      case 'code': return <code>{node}</code>
      case 'link': {
        const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : null
        if (!href || !isSafeLink(href)) return node
        // noopener/noreferrer: reader-authored links must not get a handle on this window.
        return <a href={href} target="_blank" rel="noopener noreferrer nofollow">{node}</a>
      }
      default: return node
    }
  }, text)
}
