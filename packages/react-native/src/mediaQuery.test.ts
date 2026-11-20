import { isMediaKey, readMediaQuery, type WindowState } from './mediaQuery'

const phone: WindowState = { width: 400, height: 800, colorScheme: 'light', reducedMotion: false }
const tablet: WindowState = { width: 1024, height: 768, colorScheme: 'dark', reducedMotion: true }

/** Whether `query` matches `state`, with `1rem` 16 pixels unless `remBase` is given. */
const matches = (query: string, state: WindowState, remBase = 16) =>
  readMediaQuery(query).matches(state, remBase)

/** The widths from 0 to 1000, in steps of 100, at which `query` matches. */
const widthsOf = (query: string) =>
  Array.from({ length: 11 }, (_, step) => step * 100).filter((width) =>
    matches(query, { ...phone, width })
  )

describe('a media query key', () => {
  it('is @media with white space or a parenthesis after it', () => {
    expect(isMediaKey('@media (min-width: 600px)')).toBe(true)
    expect(isMediaKey('@media(min-width:600px)')).toBe(true)
    expect(isMediaKey('@MEDIA screen')).toBe(true)
    expect(isMediaKey('@media')).toBe(false)
    expect(isMediaKey('@mediaeval')).toBe(false)
    expect(isMediaKey('@supports (display: grid)')).toBe(false)
    expect(isMediaKey('@scheme dark')).toBe(false)
  })
})

describe('readMediaQuery', () => {
  it('reads min-width, max-width and width, with or without @media and white space', () => {
    expect(widthsOf('@media (min-width: 600px)')).toEqual([600, 700, 800, 900, 1000])
    expect(widthsOf('@media(max-width:300px)')).toEqual([0, 100, 200, 300])
    expect(widthsOf('(width: 500px)')).toEqual([500])
    expect(widthsOf('  @media   (  MIN-WIDTH :  600PX  )  ')).toEqual([600, 700, 800, 900, 1000])
  })

  it('reads min-height, max-height and height', () => {
    expect(matches('(min-height: 800px)', phone)).toBe(true)
    expect(matches('(min-height: 801px)', phone)).toBe(false)
    expect(matches('(max-height: 768px)', tablet)).toBe(true)
    expect(matches('(max-height: 767px)', tablet)).toBe(false)
    expect(matches('(height: 800px)', phone)).toBe(true)
  })

  it('reads the range forms, either way round and with both ends', () => {
    expect(widthsOf('@media (width >= 600px)')).toEqual([600, 700, 800, 900, 1000])
    expect(widthsOf('(width>600px)')).toEqual([700, 800, 900, 1000])
    expect(widthsOf('(width <= 300px)')).toEqual([0, 100, 200, 300])
    expect(widthsOf('(width < 300px)')).toEqual([0, 100, 200])
    expect(widthsOf('(width = 300px)')).toEqual([300])
    expect(widthsOf('(600px <= width)')).toEqual([600, 700, 800, 900, 1000])
    expect(widthsOf('(600px < width)')).toEqual([700, 800, 900, 1000])
    expect(widthsOf('(300px >= width)')).toEqual([0, 100, 200, 300])
    expect(widthsOf('(300px > width)')).toEqual([0, 100, 200])
    expect(widthsOf('(400px <= width <= 800px)')).toEqual([400, 500, 600, 700, 800])
    expect(widthsOf('(400px < width < 800px)')).toEqual([500, 600, 700])
    expect(widthsOf('(800px >= width > 400px)')).toEqual([500, 600, 700, 800])
    expect(matches('(height >= 800px)', phone)).toBe(true)
    expect(matches('(700px < height < 800px)', phone)).toBe(false)
  })

  it('reads orientation, the color scheme and reduced motion', () => {
    expect(matches('(orientation: portrait)', phone)).toBe(true)
    expect(matches('(orientation: landscape)', phone)).toBe(false)
    expect(matches('(orientation: landscape)', tablet)).toBe(true)
    expect(matches('(orientation: portrait)', { ...phone, width: 800 })).toBe(true)
    expect(matches('(prefers-color-scheme: dark)', tablet)).toBe(true)
    expect(matches('(prefers-color-scheme: light)', tablet)).toBe(false)
    expect(matches('(prefers-color-scheme: light)', { ...phone, colorScheme: null })).toBe(true)
    expect(matches('(prefers-reduced-motion: reduce)', tablet)).toBe(true)
    expect(matches('(prefers-reduced-motion: no-preference)', phone)).toBe(true)
    expect(matches('(prefers-reduced-motion: reduce)', phone)).toBe(false)
  })

  it('joins features with and, reads a comma list as or, and takes not, only, screen and all', () => {
    const range = '@media screen and (min-width: 300px) and (max-width: 600px)'
    expect(widthsOf(range)).toEqual([300, 400, 500, 600])
    expect(widthsOf('(max-width: 100px), (min-width: 900px)')).toEqual([0, 100, 900, 1000])
    expect(widthsOf('not all and (min-width: 300px)')).toEqual([0, 100, 200])
    expect(widthsOf('not (min-width: 300px)')).toEqual([0, 100, 200])
    expect(widthsOf('only screen and (width < 200px)')).toEqual([0, 100])
    expect(matches('@media all', phone)).toBe(true)
    expect(matches('@media screen', phone)).toBe(true)
    expect(matches('@media not screen', phone)).toBe(false)
    expect(matches('(min-width:300px)and(max-width:600px)', phone)).toBe(true)
  })

  it('takes a length in px, without a unit, in rem and in em, the last two times remBase', () => {
    expect(matches('(min-width: 400)', phone)).toBe(true)
    expect(matches('(min-width: 25rem)', phone)).toBe(true)
    expect(matches('(min-width: 25.1rem)', phone)).toBe(false)
    expect(matches('(min-width: 25em)', phone)).toBe(true)
    expect(matches('(min-width: 40rem)', phone, 10)).toBe(true)
    expect(matches('(min-width: 40em)', phone, 10)).toBe(true)
    expect(matches('(min-width: .5rem)', phone)).toBe(true)
    expect(matches('(max-width: -1px)', phone)).toBe(false)
  })

  it('never matches what it does not evaluate, and names it', () => {
    const problems = {
      '@media (hover: hover)': 'the media feature "hover"',
      '@media (pointer: coarse)': 'the media feature "pointer"',
      '@media print': 'the media type "print"',
      '@media screen and (resolution >= 2dppx)': 'the media feature "resolution"',
      '@media (2dppx <= resolution)': 'the media feature "resolution"',
      '@media (hover)': 'the media feature "hover"',
      '@media (width)': 'the media feature "width"',
      '@media (min-width: 50vw)': 'the unit "vw"',
      '@media (min-width: 10%)': 'the unit "%"',
      '@media (width >= 10cm)': 'the unit "cm"',
      '@media (400px < width < 10cm)': 'the unit "cm"',
      '@media (10cm < width < 400px)': 'the unit "cm"',
      '@media (min-width: wide)': 'the value "wide"',
      '@media (orientation: square)': 'the value "square" of orientation',
      '@media (prefers-color-scheme: no-preference)':
        'the value "no-preference" of prefers-color-scheme',
      '@media (min-width: 1px), print': 'the media type "print"',
    }
    for (const [query, problem] of Object.entries(problems)) {
      expect(readMediaQuery(query).problem).toBe(problem)
      expect(matches(query, phone)).toBe(false)
      expect(matches(query, tablet)).toBe(false)
    }
  })

  it('never matches what is not a media query, and names the text', () => {
    const problems = {
      '@media ': 'the text ""',
      '@media (min-width: 1px) or (max-width: 2px)':
        'the text "(min-width: 1px) or (max-width: 2px)"',
      '@media screen (min-width: 1px)': 'the text "screen (min-width: 1px)"',
      '@media screen and': 'the text "screen and"',
      '@media (min-width: 1px) and': 'the text "(min-width: 1px) and"',
      '@media ((min-width: 1px))': 'the text "((min-width: 1px))"',
      '@media (600px)': 'the text "(600px)"',
      '@media (1px < 2px)': 'the range "1px < 2px"',
      '@media (1px < width = 2px)': 'the range "1px < width = 2px"',
      '@media (1px < width > 2px)': 'the range "1px < width > 2px"',
      '@media (1px < 2px < 3px)': 'the range "1px < 2px < 3px"',
    }
    for (const [query, problem] of Object.entries(problems)) {
      expect(readMediaQuery(query).problem).toBe(problem)
      expect(matches(query, phone)).toBe(false)
    }
  })

  it('reads each text once', () => {
    expect(readMediaQuery('(min-width: 1px)')).toBe(readMediaQuery('(min-width: 1px)'))
    expect(readMediaQuery('(min-width: 1px)')).not.toBe(readMediaQuery('(min-width:1px)'))
    expect(readMediaQuery('(min-width: 1px)').problem).toBeUndefined()
  })
})
