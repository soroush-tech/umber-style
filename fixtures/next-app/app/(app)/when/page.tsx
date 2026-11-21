import { at } from '@umber-style/react'
import { Page } from '@umber-fixtures/shared/components'
import { style, styled } from '@umber-fixtures/shared/style'

// Underlined where the nearest scheme is dark: at the top, that is the class on <html> of `isRoot`.
const SchemeProbe = styled('p', { name: 'SchemeProbe' })({
  ...at(style.whenScheme('dark'), { textDecorationLine: 'underline' }),
})

export default function WhenPage() {
  return (
    <Page data-testid="page-when">
      <SchemeProbe data-testid="when-probe">Scheme</SchemeProbe>
    </Page>
  )
}
