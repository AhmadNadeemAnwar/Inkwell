import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RichText } from './RichText'

const IMAGE_ID = '0b6f8f0e-2f0b-4a53-9a3e-0e6a1f4f7c11'

const paragraph = (words: string) => ({ type: 'paragraph', content: [{ type: 'text', text: words }] })
const html = (body: unknown) => renderToStaticMarkup(<RichText contentJson={typeof body === 'string' ? body : JSON.stringify(body)} />)
const sections = (...content: unknown[]) => ({ type: 'sections', content })

describe('RichText', () => {
  it('still renders a post written before sections existed', () => {
    const out = html({ type: 'doc', content: [paragraph('An older post.'), { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A heading' }] }] })

    expect(out).toContain('<p>An older post.</p>')
    expect(out).toContain('<h2>A heading</h2>')
  })

  it('renders sections in the order they were arranged', () => {
    const out = html(sections(
      { type: 'textSection', content: [paragraph('Opening.')] },
      { type: 'imageSection', attrs: { imageId: IMAGE_ID, alt: 'A chart', caption: 'Figure 1' } },
      { type: 'textSection', content: [paragraph('Closing.')] },
    ))

    expect(out.indexOf('Opening.')).toBeLessThan(out.indexOf('<figure'))
    expect(out.indexOf('<figure')).toBeLessThan(out.indexOf('Closing.'))
  })

  it('shows an uploaded picture from the API with its description and caption', () => {
    const out = html(sections({ type: 'imageSection', attrs: { imageId: IMAGE_ID, alt: 'A chart', caption: 'Figure 1' } }))

    expect(out).toContain(`src="/media/${IMAGE_ID}"`)
    expect(out).not.toContain('/api/v1/images/')
    expect(out).toContain('alt="A chart"')
    expect(out).toContain('<figcaption>Figure 1</figcaption>')
  })

  it('gives a picture its size when the post has it, so the page can hold its place', () => {
    const out = html(sections({ type: 'imageSection', attrs: { imageId: IMAGE_ID, alt: '', width: 1600, height: 900 } }))

    expect(out).toContain('width="1600"')
    expect(out).toContain('height="900"')
  })

  it.each([
    ['only a width', { width: 1600 }],
    ['a size of zero', { width: 0, height: 0 }],
    ['a size given as text', { width: '1600', height: '900' }],
    ['a fractional size', { width: 1600.5, height: 900 }],
    ['an absurd size', { width: 999999, height: 900 }],
  ])('shows the picture without a size when the post has %s', (_, size) => {
    const out = html(sections({ type: 'imageSection', attrs: { imageId: IMAGE_ID, alt: '', ...size } }))

    expect(out).toContain('<img')
    expect(out).not.toContain('width=')
    expect(out).not.toContain('height=')
  })

  it('loads the first picture at once and the others as the reader reaches them', () => {
    const out = html(sections(
      { type: 'imageSection', attrs: { imageId: IMAGE_ID, alt: 'first' } },
      { type: 'textSection', content: [paragraph('Between.')] },
      { type: 'imageSection', attrs: { imageId: '11111111-2f0b-4a53-9a3e-0e6a1f4f7c11', alt: 'second' } },
    ))

    expect(out).toMatch(/alt="first"[^>]*loading="eager"/)
    expect(out).toMatch(/alt="second"[^>]*loading="lazy"/)
  })

  it('leaves the caption out when there is none', () => {
    expect(html(sections({ type: 'imageSection', attrs: { imageId: IMAGE_ID, alt: '' } }))).not.toContain('figcaption')
  })

  it.each([
    ['a link to another site', 'https://evil.example/tracker.png'],
    ['a path that climbs out of the images folder', '../admin/stats'],
    ['a script address', 'javascript:alert(1)'],
    ['nothing', ''],
  ])('shows no picture when the image id is %s', (_, imageId) => {
    const out = html(sections({ type: 'imageSection', attrs: { imageId } }))

    expect(out).not.toContain('<img')
    expect(out).not.toContain('evil.example')
  })

  it('lists sources, linking the ones that have a web address', () => {
    const out = html(sections({ type: 'referencesSection', attrs: { items: [
      { title: 'The paper', url: 'https://example.com/paper' },
      { title: 'A book with no link', url: '' },
    ] } }))

    expect(out).toContain('<h2>References</h2>')
    expect(out).toContain('<a href="https://example.com/paper" target="_blank" rel="noopener noreferrer nofollow">The paper</a>')
    expect(out).toContain('<li>A book with no link</li>')
  })

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//evil.example', 'mailto:someone@example.com'])(
    'shows a source with the address %s as plain text, never as a link',
    (url) => {
      const out = html(sections({ type: 'referencesSection', attrs: { items: [{ title: 'Click me', url }] } }))

      expect(out).toContain('<li>Click me</li>')
      expect(out).not.toContain('<a')
    },
  )

  it('shows nothing for a reference section with no usable sources', () => {
    const out = html(sections({ type: 'referencesSection', attrs: { items: [{ title: '   ', url: 'https://example.com' }, 'junk', null] } }))

    expect(out).not.toContain('References')
  })

  it('never turns text into markup', () => {
    const out = html(sections(
      { type: 'textSection', content: [paragraph('<script>alert(1)</script>')] },
      { type: 'imageSection', attrs: { imageId: IMAGE_ID, alt: '"><script>alert(2)</script>', caption: '<img src=x onerror=alert(3)>' } },
      { type: 'referencesSection', attrs: { items: [{ title: '<b>bold</b>', url: '' }] } },
    ))

    expect(out).not.toContain('<script>')
    expect(out).not.toContain('<img src=x')
    expect(out).not.toContain('<b>bold</b>')
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('ignores a section of a kind it does not know, and keeps the rest', () => {
    const out = html(sections({ type: 'scriptSection', attrs: { src: 'https://evil.example/x.js' } }, { type: 'textSection', content: [paragraph('Kept.')] }))

    expect(out).toContain('<p>Kept.</p>')
    expect(out).not.toContain('evil.example')
  })

  it.each(['not json', 'null', '{"type":"sections","content":"nope"}', '{"type":"sections","content":[null, 7, "x"]}'])(
    'does not crash on the broken body %s',
    (body) => {
      expect(() => html(body)).not.toThrow()
    },
  )
})
