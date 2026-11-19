import { bootScript } from '@umber-fixtures/shared/bootScript'
import { darkClass, lightClass, style } from '@umber-fixtures/shared/style'
import { extractPageStyles } from '@umber-style/core'
import Document, {
  Head,
  Html,
  Main,
  NextScript,
  type DocumentContext,
  type DocumentInitialProps,
} from 'next/document'

type StyleProps = { css: string; options: string }

// The approach of docs/server-rendering.md: render, then ask the cache for the CSS of this page, from
// the markup that Next rendered for it. The themes of <html> and the one it can switch to are not in
// that markup.
export default class AppDocument extends Document<StyleProps> {
  static async getInitialProps(
    context: DocumentContext
  ): Promise<DocumentInitialProps & StyleProps> {
    const initial = await Document.getInitialProps(context)
    const { css, options } = extractPageStyles(style.cache, initial.html, {
      themes: [lightClass, darkClass],
    })
    return { ...initial, css, options }
  }

  render() {
    const { css, options } = this.props
    return (
      <Html lang="en" className={lightClass}>
        <Head>
          <link rel="icon" href="data:," />
          <style
            data-style={style.cache.prefix}
            data-options={options}
            dangerouslySetInnerHTML={{ __html: css }}
          />
          <script dangerouslySetInnerHTML={{ __html: bootScript(lightClass, darkClass) }} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
