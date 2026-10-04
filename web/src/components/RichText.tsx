import type { ReactNode } from 'react'

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

/**
 * Renders a stored ProseMirror document as React elements.
 *
 * Deliberately does not use dangerouslySetInnerHTML: only the node and mark types listed
 * below are rendered, so a crafted document cannot inject markup or script into a reader's
 * page. Anything unrecognised degrades to its plain text.
 */
export function RichText({ contentJson }: { contentJson: string }) {
  let doc: Node
  try {
    doc = JSON.parse(contentJson)
  } catch {
    return <p className="muted">This post could not be displayed.</p>
  }

  return <div className="prose">{renderChildren(doc.content)}</div>
}

function renderChildren(nodes: Node[] | undefined): ReactNode {
  if (!nodes) return null
  return nodes.map((node, index) => <RenderNode key={index} node={node} />)
}

function RenderNode({ node }: { node: Node }): ReactNode {
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
      if (!src || !isSafeUrl(src)) return null
      return <img src={src} alt={typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''} />
    }

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
        if (!href || !isSafeUrl(href)) return node
        // noopener/noreferrer: reader-authored links must not get a handle on this window.
        return <a href={href} target="_blank" rel="noopener noreferrer nofollow">{node}</a>
      }
      default: return node
    }
  }, text)
}

/** Blocks javascript: and data: URLs, which are the usual vectors in user-supplied links. */
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase()
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    || trimmed.startsWith('/') || trimmed.startsWith('mailto:')
}
