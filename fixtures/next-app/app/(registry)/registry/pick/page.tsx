import { RegistryFrame, RegistryPick } from '../../parts'

export const dynamic = 'force-dynamic'

// Two requests of this page with another `kind` render parts with no class in common. The page waits
// before it renders, so that two requests sent together are rendered at the same time.
export default async function RegistryPickPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  const { kind = 'badge' } = await searchParams
  await new Promise((resolve) => setTimeout(resolve, 300))
  return (
    <RegistryFrame testId="page-registry-pick" title={`Pick ${kind}`}>
      <RegistryPick kind={kind} />
    </RegistryFrame>
  )
}
