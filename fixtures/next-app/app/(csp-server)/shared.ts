import { styled } from './style'

// The card of /csp-server/shared, imported by a server component and by a client component (#91): each
// side has its own copy of this module, made with its own build of the binding, and the same class.

/** A card that both sides render. */
export const SharedCard = styled('section', { name: 'CspServerSharedCard' })({
  display: 'block',
  paddingLeft: 23,
  borderLeftWidth: 4,
  borderLeftStyle: 'solid',
})
