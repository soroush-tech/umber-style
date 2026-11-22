// Set up by @soroush.tech/design-system init. Your themes: change any value, or add a theme.
// Every token is listed at https://docs.soroush.tech/design-system/customization/theming/
import { baseTheme, createTheme } from '@soroush.tech/design-system/theme'

// To add tokens of your own, declare them here, then give them values in each theme:
//
// import type { PaletteEntry } from '@soroush.tech/design-system/theme'
//
// declare module '@soroush.tech/design-system/theme' {
//   interface ThemePalette {
//     brand: PaletteEntry
//   }
// }

const themes = {
  light: createTheme(baseTheme, {
    name: 'light',
    colorScheme: 'light',
    logoFilter: 'brightness(0)',
    portraitBlend: 'multiply',
    portraitOpacity: 1,
    palette: {
      default: { main: '#6B5A45', light: '#8F9094', dark: '#2F1702', contrastText: '#FFFFFF' },
      primary: { main: '#36603A', light: '#DCE6D8', dark: '#112917', contrastText: '#F4F0E4' },
      secondary: { main: '#96784E', light: '#E9DFCC', dark: '#838264', contrastText: '#FFFFFF' },
      success: { main: '#009928', light: '#E8FFE5', dark: '#006413', contrastText: '#FFFFFF' },
      error: { main: '#BA1A1A', light: '#FFDAD6', dark: '#93000A', contrastText: '#FFFFFF' },
      info: { main: '#0071A4', light: '#E0FAFF', dark: '#004D70', contrastText: '#FFFFFF' },
      warning: { main: '#CCA800', light: '#FFF0A0', dark: '#8C6D00', contrastText: '#FFFFFF' },
    },
    background: {
      backdrop: '#00000080',
      appBar: '#F4F0E4D9',
      glass: '#FFFFFF4D',
      modal: '#FFFFFF',
      default: '#E6E3DE',
      primary: '#F4F0E4',
      secondary: '#E6E3DE',
      paper: '#FAF7EF',
      terminal: '#112917',
      grid: '#96784E26',
      transparent: '#00000000',
      scrollbar: '#0000004D',
      scrollbarTrack: '#F3F3F380',
    },
    text: {
      inherit: 'inherit',
      initial: '#2F1702',
      primary: '#36603A',
      secondary: '#6B5A45',
      disabled: '#2F170273',
      error: '#BA1A1A',
      success: '#009928',
      info: '#0071A4',
      warning: '#8C6D00',
    },
    border: {
      default: '#2F170224',
      light: '#2F170214',
      primary: '#36603A',
      dark: '#2F1702',
    },
    skeleton: {
      highlight: '#FFFFFFA6',
    },
  }),
  dark: createTheme(baseTheme, {
    name: 'dark',
    colorScheme: 'dark',
    palette: {
      primary: {
        main: '#B5C1B8',
        light: '#3A2410',
        dark: '#8FA596',
        contrastText: '#1A0D01',
      },
      secondary: {
        main: '#B08A56',
        light: '#3A2410',
        dark: '#96784E',
      },
      default: {
        main: '#B5C1B8',
        dark: '#F4F0E4',
      },
    },
    text: {
      initial: '#F4F0E4',
      primary: '#B5C1B8',
      secondary: '#B5C1B8',
      disabled: '#F4F0E473',
    },
    background: {
      default: '#1A0D01',
      primary: '#2F1702',
      secondary: '#3A2410',
      paper: '#3A2410',
      appBar: '#2F1702D9',
      terminal: '#1A0D01',
      grid: '#B08A5626',
    },
    border: {
      default: '#F4F0E424',
      light: '#F4F0E414',
      primary: '#B5C1B8',
      dark: '#F4F0E4',
    },
  }),
}

export default themes
