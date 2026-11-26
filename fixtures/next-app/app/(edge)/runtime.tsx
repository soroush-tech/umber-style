/** The runtime that rendered the page, as the framework names it in `NEXT_RUNTIME`: `edge` or `nodejs`. */
export function Runtime() {
  return <p data-testid="edge-runtime">{process.env.NEXT_RUNTIME}</p>
}
