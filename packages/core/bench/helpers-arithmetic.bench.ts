// What one operation is, in this file: one call of the helper with the arguments in the case name.
// "Token" means the argument is a `var(--name)` reference, which the helper can only write as a
// `calc()` for the browser to compute; "literal" means a number or a length it can compute itself.
// There is no cache and no state: every case measures the helper alone.
import type { BenchConfig } from '@soroush.tech/bench'
import { core } from './core'

const { add, divide, multiply, negate, subtract } = core
const token = 'var(--b-space-2)'
const other = 'var(--b-space-3)'

export default {
  name: 'core: arithmetic helpers',
  cases: {
    'multiply: token': () => multiply(token, 2),
    'multiply: literal number': () => multiply(8, 2),
    'multiply: literal length': () => multiply('8px', 2),
    'divide: token': () => divide(token, 2),
    'divide: literal number': () => divide(8, 2),
    'divide: literal length': () => divide('8px', 2),
    'add: token and token': () => add(token, other),
    'add: token and number': () => add(token, 4),
    'add: literal numbers': () => add(4, 8),
    'add: literal lengths': () => add('4px', '8px'),
    'subtract: token and token': () => subtract(token, other),
    'subtract: token and number': () => subtract(token, 4),
    'subtract: literal numbers': () => subtract(12, 4),
    'subtract: literal lengths': () => subtract('12px', '4px'),
    'negate: token': () => negate(token),
    'negate: literal number': () => negate(8),
    'negate: literal length': () => negate('8px'),
  },
} satisfies BenchConfig
