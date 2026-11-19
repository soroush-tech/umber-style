import { scanHtml } from './scanHtml'

const classes = (html: string) => [...scanHtml(html).classes]

describe('scanHtml', () => {
  it('reads the class attributes, quoted either way and bare', () => {
    expect(
      classes(`<div class="a b"><p class='c  d'></p><i class=e></i><b class = "f"></b></div>`)
    ).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('reads className and any case of the name', () => {
    expect(classes('<div className="a" CLASS="b" ClassName=c>')).toEqual(['a', 'b', 'c'])
  })

  it('ignores a class name in any other attribute, and attributes without a value', () => {
    expect(classes('<div data-class="x" title="a b" hidden disabled id=y class="z">')).toEqual([
      'z',
    ])
  })

  it('reads the keys of the style elements that the document carries', () => {
    const found = scanHtml(
      '<style data-precedence="u" data-href="u-a u-b">.u-a{}</style><div class="u-a">'
    )
    expect([...found.carried]).toEqual(['u-a', 'u-b'])
    expect([...found.classes]).toEqual(['u-a'])
  })

  it('skips comments, scripts, styles, textareas and titles', () => {
    const html =
      '<!-- <div class="no1"> --><script>var s = "<div class=\\"no2\\">"</script>' +
      '<STYLE>.x::after{content:"<i class=no3>"}</STYLE><textarea><i class="no4"></textarea>' +
      '<title><i class="no5"></title><p class="yes">'
    expect(classes(html)).toEqual(['yes'])
  })

  it('reads on after a raw text element, whatever the case of its closing tag', () => {
    expect(
      classes('<script>1</SCRIPT><p class="a"></p><script></p></script ><p class="b">')
    ).toEqual(['a', 'b'])
  })

  it('does not take text, closing tags, doctype and stray angle brackets for tags', () => {
    expect(classes('<!doctype html>1 < 2 <3 </div class="no"><p class="a">x > y</p>')).toEqual([
      'a',
    ])
  })

  it('handles an attribute that starts with an equals sign, a self-closing tag and spaces around the value', () => {
    expect(classes('<div =x class="a"/><br class=b/><i class= "c" >')).toEqual(['a', 'b/', 'c'])
  })

  it('survives a document that ends inside a comment, a tag, a value or a raw text element', () => {
    expect(classes('<p class="a"></p><!-- never closed')).toEqual(['a'])
    expect(classes('<p class="a"></p><div class="b')).toEqual(['a', 'b'])
    expect(classes('<p class="a"></p><div class=')).toEqual(['a'])
    expect(classes('<p class="a"></p><div')).toEqual(['a'])
    expect(classes('<p class="a"></p><script>"never closed')).toEqual(['a'])
    expect(classes('<p class="a"></p><script></notscript>')).toEqual(['a'])
    expect(classes('')).toEqual([])
  })

  it('takes linear time on a large document, and on input made to defeat backtracking', () => {
    const rows = Array.from({ length: 50000 }, (_, index) => `<div class="a${index} b">x</div>`)
    const nasty = `<div class="${'a '.repeat(100000)}"><p ${'x='.repeat(50000)}>${'<'.repeat(100000)}`
    const start = performance.now()
    expect(scanHtml(rows.join('')).classes.size).toBe(50001)
    scanHtml(nasty)
    expect(performance.now() - start).toBeLessThan(1500)
  })
})
