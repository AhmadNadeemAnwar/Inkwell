/** A small "AI" sparkle (a large and a small four-point star), for buttons that use generation. Decorative: the button's text is its name. */
export function SparkleIcon() {
  return (
    <svg className="btn__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M10 5.5Q10 14 18.5 14Q10 14 10 22.5Q10 14 1.5 14Q10 14 10 5.5Z" />
      <path fill="currentColor" d="M19.5 1.5Q19.5 5.5 23.5 5.5Q19.5 5.5 19.5 9.5Q19.5 5.5 15.5 5.5Q19.5 5.5 19.5 1.5Z" />
    </svg>
  )
}
