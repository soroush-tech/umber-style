import { RegistryHome } from '../../(registry)/parts'
import { CspFrame } from '../parts'

// Rendered at once, under the policy: every rule is in the first flush of the registry.
export default function CspPage() {
  return (
    <CspFrame testId="page-csp" title="Registry with a nonce">
      <RegistryHome />
    </CspFrame>
  )
}
