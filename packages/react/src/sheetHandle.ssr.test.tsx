// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

/** The class of the element whose id is `id` in `html`. */
const classOf = (html: string, id: string) =>
  new RegExp(`<[^>]* id="${id}"[^>]*>`).exec(html)?.[0].match(/class="([^"]+)"/)?.[1]

describe('a handle in a server render of the client build', () => {
  it('gives a handle the class of useStyle under nested providers', () => {
    const style = createStyle(theme, { prefix: 'sh' })
    const sheet = style.StyleSheet.create((view) => ({ box: { padding: view.space[2] } }))
    const Box = style.styled('div')({ display: 'block' })
    const Probe = () => {
      const styles = style.useStyle(sheet)
      return (
        <>
          <Box id="h" style={sheet.box} />
          <Box id="k" style={styles.box} />
        </>
      )
    }
    const html = renderToStaticMarkup(
      <style.ThemeProvider theme={theme}>
        <style.ThemeProvider theme={{ space: [0, 5, 10] }}>
          <Probe />
        </style.ThemeProvider>
      </style.ThemeProvider>
    )
    expect(classOf(html, 'h')).toBeDefined()
    expect(classOf(html, 'h')).toBe(classOf(html, 'k'))
  })
})
