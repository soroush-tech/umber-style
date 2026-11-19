import { bootScript } from '@umber-fixtures/shared/bootScript'
import { darkClass, lightClass, style } from '@umber-fixtures/shared/style'
import Document, {
  Head,
  Html,
  Main,
  NextScript,
  type DocumentContext,
  type DocumentInitialProps,
} from 'next/document'

type StyleProps = { css: string; ids: string[] }

// The approach of docs/server-rendering.md: render, then ask the cache for what it holds, here in the
// custom document, for each request. `extract()` is what `createStyleTag` writes into its element.
export default class AppDocument extends Document<StyleProps> {
  static async getInitialProps(
    context: DocumentContext
  ): Promise<DocumentInitialProps & StyleProps> {
    const initial = await Document.getInitialProps(context)
    return { ...initial, ...style.cache.extract() }
  }

  render() {
    const { css, ids } = this.props
    return (
      <Html lang="en" className={lightClass}>
        <Head>
          <link rel="icon" href="data:," />
          <style
            data-style={style.cache.prefix}
            data-ids={ids.join(' ')}
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
