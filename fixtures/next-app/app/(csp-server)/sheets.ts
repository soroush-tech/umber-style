import { StyleSheet } from './style'

// The sheets of /csp-server/sheets, imported by server components and by client components: each side
// has its own copy of this module, made with its own build of the binding. Each name has a padding of its
// own, so that a test tells the cases apart by their computed style.

/** A sheet made from a function of the theme: each name is a handle (`sheet.card`). */
export const sheet = StyleSheet.create((theme) => ({
  card: {
    paddingLeft: 31,
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: theme.palette.accent,
  },
  serverCard: { paddingLeft: 41, outlineStyle: 'solid', outlineColor: theme.palette.primary },
  label: { paddingLeft: 43, color: theme.palette.accent },
  root: { paddingLeft: 33, borderTopWidth: 2, borderTopStyle: 'dotted' },
  avatar: { marginLeft: 7, color: theme.palette.primary },
  // The slots of the client have names of their own: a class that server components and client
  // components both write is not what these pages test.
  clientRoot: { paddingLeft: 35, borderTopWidth: 2, borderTopStyle: 'dashed' },
  clientAvatar: { marginLeft: 9, color: theme.palette.primary },
}))

/** An object sheet: its entries exist at once, with no theme. */
export const objectSheet = StyleSheet.create({
  card: { paddingLeft: 37, outlineStyle: 'dashed', outlineWidth: 2 },
})
