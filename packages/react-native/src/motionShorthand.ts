import { isEasingWord, readCssNumber, readTime, splitList, splitWords } from './motionText'

/** The longhands of `animation`, in the order a shorthand resets them. */
export const ANIMATION_LONGHANDS = [
  'animationName',
  'animationDuration',
  'animationTimingFunction',
  'animationDelay',
  'animationIterationCount',
  'animationDirection',
  'animationFillMode',
  'animationPlayState',
] as const

/** The longhands of `transition`, in the order a shorthand resets them. */
export const TRANSITION_LONGHANDS = [
  'transitionProperty',
  'transitionDuration',
  'transitionTimingFunction',
  'transitionDelay',
  'transitionBehavior',
] as const

/** The values of `animation-direction`. */
export const DIRECTIONS: ReadonlySet<string> = new Set([
  'normal',
  'reverse',
  'alternate',
  'alternate-reverse',
])

/** The values of `animation-fill-mode`. */
export const FILL_MODES: ReadonlySet<string> = new Set(['none', 'forwards', 'backwards', 'both'])

/** The values of `animation-play-state`. */
export const PLAY_STATES: ReadonlySet<string> = new Set(['running', 'paused'])

/** The values of `transition-behavior`. */
export const BEHAVIORS: ReadonlySet<string> = new Set(['normal', 'allow-discrete'])

/** What a shorthand gives: each longhand as a comma list, one item for each item of the shorthand; or the part that could not be read. */
export type Expansion =
  | { readonly longhands: Readonly<Record<string, string>> }
  | { readonly problem: string }

/** One part of a shorthand: the longhand it may set, and whether a word is a value of it. */
type Slot = readonly [string, (word: string, lower: string) => boolean]

const isTimeWord = (word: string) => readTime(word) !== undefined
const isAny = () => true

/**
 * The parts of one item of `animation`, in the order a word is tried: the first part that is not set yet
 * and takes the word gets it. The first time is the duration and the second the delay; a keyword of a
 * part that is set already falls through to the name, as CSS reads it.
 */
const ANIMATION_SLOTS: readonly Slot[] = [
  ['animationDuration', isTimeWord],
  ['animationDelay', isTimeWord],
  ['animationTimingFunction', isEasingWord],
  [
    'animationIterationCount',
    (word, lower) => lower === 'infinite' || readCssNumber(word) !== undefined,
  ],
  ['animationDirection', (_word, lower) => DIRECTIONS.has(lower)],
  ['animationFillMode', (_word, lower) => FILL_MODES.has(lower)],
  ['animationPlayState', (_word, lower) => PLAY_STATES.has(lower)],
  ['animationName', isAny],
]

/** The parts of one item of `transition`, tried in the same way: what is no time, easing or behavior is the property. */
const TRANSITION_SLOTS: readonly Slot[] = [
  ['transitionDuration', isTimeWord],
  ['transitionDelay', isTimeWord],
  ['transitionTimingFunction', isEasingWord],
  ['transitionBehavior', (_word, lower) => BEHAVIORS.has(lower)],
  ['transitionProperty', isAny],
]

/** The initial value of each longhand: what a shorthand sets for a part it does not give. */
const INITIAL: Readonly<Record<string, string>> = {
  animationName: 'none',
  animationDuration: '0s',
  animationTimingFunction: 'ease',
  animationDelay: '0s',
  animationIterationCount: '1',
  animationDirection: 'normal',
  animationFillMode: 'none',
  animationPlayState: 'running',
  transitionProperty: 'all',
  transitionDuration: '0s',
  transitionTimingFunction: 'ease',
  transitionDelay: '0s',
  transitionBehavior: 'normal',
}

/** The parts of one item, word by word; the word that no part takes, as a string, when there is one. */
function readItem(
  item: string,
  slots: readonly Slot[],
  isName: (word: string) => boolean
): Record<string, string> | string {
  const found: Record<string, string> = {}
  for (const word of splitWords(item)) {
    // A name that `keyframes` returned is the name, whatever else it could be read as.
    const isOwnName = isName(word) && found.animationName === undefined
    const slot = isOwnName
      ? 'animationName'
      : slots.find(
          ([name, takes]) => found[name] === undefined && takes(word, word.toLowerCase())
        )?.[0]
    if (slot === undefined) return word
    found[slot] = word
  }
  return found
}

/** `text` read as a shorthand with the parts of `slots`, each longhand of `longhands` a comma list. */
function expand(
  text: string,
  slots: readonly Slot[],
  longhands: readonly string[],
  isName: (word: string) => boolean
): Expansion {
  const items = splitList(text)
  const lists: Record<string, string[]> = Object.fromEntries(longhands.map((name) => [name, []]))
  for (const item of items) {
    const found = readItem(item, slots, isName)
    if (typeof found === 'string') return { problem: found }
    for (const name of longhands) lists[name].push(found[name] ?? INITIAL[name])
  }
  if (items.length === 0) return { problem: text }
  const entries = longhands.map((name) => [name, lists[name].join(', ')])
  return { longhands: Object.fromEntries(entries) }
}

/**
 * The `animation` shorthand expanded into its longhands as CSS expands it: every longhand is set, a part
 * that is not given to its initial value, and a list gives a list in each. `isName` tells a name that
 * `keyframes` returned, which is read as the name first.
 */
export function expandAnimation(text: string, isName: (word: string) => boolean): Expansion {
  return expand(text, ANIMATION_SLOTS, ANIMATION_LONGHANDS, isName)
}

/** The `transition` shorthand expanded into its longhands as CSS expands it; `none` is a property only alone. */
export function expandTransition(text: string): Expansion {
  const expansion = expand(text, TRANSITION_SLOTS, TRANSITION_LONGHANDS, () => false)
  if ('problem' in expansion) return expansion
  const properties = splitList(expansion.longhands.transitionProperty)
  const isNoneInList = properties.length > 1 && properties.includes('none')
  return isNoneInList ? { problem: 'none' } : expansion
}
