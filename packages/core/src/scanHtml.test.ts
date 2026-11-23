import { createGlobalMarker, scanHtml } from './scanHtml'

const classes = (html: string) => [...scanHtml(html).classes]

describe('createGlobalMarker', () => {
  it('names the sets that have rules, under the name of the prefix, and is none without one', () => {
    const sets = [
      { id: 'u-global-a', rules: ['a{}'] },
      { id: 'u-global-b', rules: [] },
      { id: 'u-global-c', rules: ['c{}'] },
    ]
    expect(createGlobalMarker('u', sets)).toEqual({
      name: 'u-global',
      ids: 'u-global-a u-global-c',
    })
    expect(createGlobalMarker('u', [sets[1]])).toBeUndefined()
    const { name, ids } = createGlobalMarker('u', sets) as { name: string; ids: string }
    expect([...scanHtml(`<!--${name} ${ids}-->`).rendered]).toEqual(['u-global-a', 'u-global-c'])
  })
})

describe('scanHtml', () => {
  it('reads the class attributes, quoted either way and bare', () => {
    expect(
      classes(`<div class="a b"><p class='c  d'></p><i class=e></i><b class = "f"></b></div>`)
    ).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('cuts a value at each run of white space, as the split on \\s+ it made before', () => {
    // Printable ASCII is cut at its spaces; a value with any other character, white space or not, is
    // split on every white space a regular expression knows, as before.
    const values = [
      '  a  b c ',
      'a',
      '',
      ' ',
      'a\tb\nc\rd\fe\vf',
      'a\u00a0b\u2003c\u3000d\ufeffe\u2028f\u1680g\u202fh\u205fi',
      'caf\u00e9 b',
      ' caf\u00e9  b ',
      'a\u0001b',
    ]
    for (const value of values) {
      const expected = [...new Set(value.split(/\s+/).filter(Boolean))]
      expect(classes(`<div class="${value}"></div>`)).toEqual(expected)
    }
    expect(classes('<div class="  x  y "></div><p class="y z">')).toEqual(['x', 'y', 'z'])
    // A value that comes again adds nothing new, in the order of first sight.
    expect(
      classes('<i class="b a"></i><i class="c"></i><i class="b a"></i><i class="a d">')
    ).toEqual(['b', 'a', 'c', 'd'])
  })

  it('reads a name in any case of ASCII, and no other character as a letter of it', () => {
    // As the lower case of each name was compared before: only ASCII capitals lower to these letters.
    expect(
      classes('<i CLASS="a"></i><i ClAsSnAmE="b"></i><i cla\u017fs="c"></i><i \u212alass="d">')
    ).toEqual(['a', 'b'])
    expect([
      ...scanHtml('<i DATA-HREF="k"></i><META NAME="u-global" CONTENT="g">').carried,
    ]).toEqual(['k'])
    expect([...scanHtml('<META NAME="u-global" CONTENT="g">').rendered]).toEqual(['g'])
    expect(
      classes('<ScRiPt><i class="no"></i></sCrIpT><TEXTAREA><i class="no"></TEXTAREA>')
    ).toEqual([])
    expect(classes('<T\u0130TLE><i class="yes"></i></T\u0130TLE><metas class="x">')).toEqual([
      'yes',
      'x',
    ])
    expect([...scanHtml('<div data-href=" a  b "></div>').carried]).toEqual(['a', 'b'])
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

  it('reads the ids that the markers of global rules name: a <meta> of React and a comment of Vue', () => {
    const found = scanHtml(
      '<meta name="u-global" content="u-global-a u-global-b"/>' +
        '<META CONTENT=u-global-c NAME=u-global>' +
        '<!--[--><!--u-global u-global-d--><!----><!-- --><!--$--><p class="x">' +
        '<meta content="u-global-e" name="u-global" />'
    )
    expect([...found.rendered]).toEqual([
      'u-global-a',
      'u-global-b',
      'u-global-c',
      'u-global-d',
      'u-global-e',
    ])
    expect([...found.classes]).toEqual(['x'])
  })

  it('reads no marker from another meta, another comment, or the name and content of another element', () => {
    const found = scanHtml(
      '<meta name="u-options" content="p=u"><meta name="description" content="u-global-a">' +
        '<!--u-options u-global-b--><!--u-global--><!--note u-global-c-->' +
        '<input name="u-global" content="u-global-d"><meta content="u-global-e">'
    )
    expect([...found.rendered]).toEqual([])
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
