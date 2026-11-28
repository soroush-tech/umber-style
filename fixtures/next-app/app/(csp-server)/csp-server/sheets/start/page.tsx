import Link from 'next/link'
import { ServerFrame } from '../../../parts'

// The page that a client-side navigation to /csp-server/sheets starts from: it renders no entry of the
// sheets, so the page reached brings every one of them in the payload of the navigation.
export default function CspServerSheetsStartPage() {
  return (
    <ServerFrame testId="page-csp-server-sheets-start" title="Sheets start">
      <Link href="/csp-server/sheets" data-testid="link-csp-server-sheets">
        Sheets
      </Link>
    </ServerFrame>
  )
}
