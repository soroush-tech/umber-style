import { RegistryFrame, RegistryOther } from '../../parts'

// The page that a client-side navigation goes to: classes of its own and a keyframes animation.
export default function RegistryOtherPage() {
  return (
    <RegistryFrame testId="page-registry-other" title="Other">
      <RegistryOther />
    </RegistryFrame>
  )
}
