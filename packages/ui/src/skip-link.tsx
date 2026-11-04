/** First focusable thing on a page: lets keyboard and screen-reader users jump past the menu. The target needs id="main". */
export function SkipLink({ label = "Skip to main content" }: { label?: string }) {
  return <a href="#main" className="skip-link">{label}</a>;
}
