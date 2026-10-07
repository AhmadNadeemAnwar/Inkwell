/**
 * The Inkwell logo, drawn through two masks so it follows the header's own colours: the quill, pot
 * and lettering take the header's text colour (white on dark headers, black on a light one chosen
 * in the admin portal), and the leaf on the i stays green. Both masks are in /public.
 */
export function Logo({ className = '' }: { className?: string }) {
  return <span role="img" aria-label="Inkwell" className={`logo ${className}`.trim()} />
}
