import { RegistryFrame, RegistryHome } from '../parts'

// Rendered at once: every rule is in the first flush of the registry.
export default function RegistryPage() {
  return (
    <RegistryFrame testId="page-registry" title="Registry">
      <RegistryHome />
    </RegistryFrame>
  )
}
