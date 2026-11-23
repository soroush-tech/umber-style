import { RegistryOther } from '../../../(registry)/parts'
import { CspFrame } from '../../parts'

// The page that a client-side navigation goes to: classes of its own and a keyframes animation, which
// the browser's cache writes under the policy.
export default function CspOtherPage() {
  return (
    <CspFrame testId="page-csp-other" title="Other">
      <RegistryOther />
    </CspFrame>
  )
}
