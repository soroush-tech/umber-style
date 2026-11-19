import { render } from '@testing-library/react'
import { createElement } from 'react'
import { StyleSheet as platform } from 'react-native'
import { NO_THEME_MESSAGE, type Theme } from '@umber-style/core'
import { bindHolder, createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'
import type { NativeStyleObject } from './nativeStyle'

const light = { palette: { primary: '#0000ff' }, space: { small: 4 } }

beforeEach(() => {
  vi.mocked(platform.create).mockClear()
})

describe('an object sheet on React Native', () => {
  it('is the platform result, usable at once with no provider and no hook, registered once on first read', () => {
    const { StyleSheet } = createStyle(light)
    const sheet = StyleSheet.create({
      box: { margin: 1, ...({ '&:hover': { color: 'red' } } as object) },
      text: { margin: 2 },
    })
    expect(platform.create).not.toHaveBeenCalled()
    expect(Object.keys(sheet)).toEqual(['box', 'text'])
    expect(platform.create).not.toHaveBeenCalled()
    expect(sheet.box).toEqual({ margin: 1 })
    expect(sheet.text).toEqual({ margin: 2 })
    expect(sheet.box).toBe(sheet.box)
    expect(platform.create).toHaveBeenCalledTimes(1)
  })

  it('is returned as it is by useStyle, which reads no theme', () => {
    const { StyleSheet, useStyle } = createStyle(light)
    const sheet = StyleSheet.create({ box: { margin: 1 } })
    let seen: unknown
    const Probe = () => {
      seen = useStyle(sheet)
      return null
    }
    render(createElement(Probe))
    expect(seen).toBe(sheet)
  })

  it('drops a condition key, which needs the providers that an object sheet does not read', () => {
    const { StyleSheet, when } = createStyle(light)
    const sheet = StyleSheet.create({ card: { padding: 8, [when(light)]: { padding: 4 } } })
    expect(sheet.card).toEqual({ padding: 8 })
  })

  it('is made on first read on the default style, so a module can create it before configure', () => {
    const style = createDefaultStyle()
    const sheet = style.StyleSheet.create({ box: { margin: 1 } })
    expect(() => style.configure({ theme: light as unknown as Theme })).not.toThrow()
    expect(sheet.box).toEqual({ margin: 1 })
    expect(style.useStyle).toBeTypeOf('function')
  })

  it('keeps a sheet made from a function of the theme as it was', () => {
    const { StyleSheet, useStyle } = createStyle(light)
    const sheet = StyleSheet.create((theme) => ({ box: { padding: theme.space.small } }))
    let seen: Record<string, NativeStyleObject> = {}
    const Probe = () => {
      seen = useStyle(sheet)
      return null
    }
    render(createElement(Probe))
    expect(seen.box).toEqual({ padding: 4 })
  })
})

describe('the types of a sheet on React Native', () => {
  it('gives styles for an object and a sheet for a function of the theme, which has none', () => {
    const { StyleSheet, apply, useStyle } = createStyle(light)
    const object = StyleSheet.create({ box: { margin: 1 } })
    const themed = StyleSheet.create((theme) => ({ box: { padding: theme.space.small } }))
    expectTypeOf(object).toEqualTypeOf<{ readonly box: NativeStyleObject }>()
    expectTypeOf(apply(object.box)).toEqualTypeOf<{ style: NativeStyleObject[] }>()
    // Hooks: only their types are checked here, they are not called.
    const useReadObject = () => useStyle(object)
    const useReadThemed = () => useStyle(themed)
    expectTypeOf<ReturnType<typeof useReadObject>>().toEqualTypeOf<{
      readonly box: NativeStyleObject
    }>()
    expectTypeOf<ReturnType<typeof useReadThemed>>().toEqualTypeOf<{ box: NativeStyleObject }>()
    // @ts-expect-error a sheet that is not resolved has no styles
    expect(themed.box).toBeUndefined()
    // @ts-expect-error it is not a style, so it is not given to apply
    expect(apply(themed)).toBeDefined()
    // @ts-expect-error a misspelt property in an object sheet
    StyleSheet.create({ box: { marginn: 1 } })
  })
})

describe('a sheet made from a function with no theme at all', () => {
  it('says so, where an object sheet would work', () => {
    const { StyleSheet, useStyle } = bindHolder<typeof light>({ baseTheme: undefined })
    const themed = StyleSheet.create((theme) => ({ box: { padding: theme.space.small } }))
    const plain = StyleSheet.create({ box: { margin: 1 } })
    const read = (sheet: unknown) => {
      const Probe = () => {
        useStyle(sheet as never)
        return null
      }
      render(createElement(Probe))
    }
    expect(() => read(plain)).not.toThrow()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => read(themed)).toThrow(NO_THEME_MESSAGE)
    spy.mockRestore()
  })
})
