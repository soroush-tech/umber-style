// What one operation is, in this file: one call of the helper with the arguments in the case name.
// "Token" means the argument is a `var(--name)` reference, which the helper can only write as a
// `calc()` for the browser to compute; "literal" means a number or a length it can compute itself.
// There is no cache and no state: every case measures the helper alone.
import { add, alpha, divide, multiply, negate, subtract } from '../src'
import { runGroup } from '@umber-bench/shared/harness'

const token = 'var(--b-space-2)'
const other = 'var(--b-space-3)'
const color = 'var(--b-palette-primary)'

it('arithmetic helpers', async (context) => {
  await runGroup(context, 'arithmetic helpers', [
    { name: 'multiply: token', fn: () => multiply(token, 2) },
    { name: 'multiply: literal number', fn: () => multiply(8, 2) },
    { name: 'multiply: literal length', fn: () => multiply('8px', 2) },
    { name: 'divide: token', fn: () => divide(token, 2) },
    { name: 'divide: literal number', fn: () => divide(8, 2) },
    { name: 'divide: literal length', fn: () => divide('8px', 2) },
    { name: 'add: token and token', fn: () => add(token, other) },
    { name: 'add: token and number', fn: () => add(token, 4) },
    { name: 'add: literal numbers', fn: () => add(4, 8) },
    { name: 'add: literal lengths', fn: () => add('4px', '8px') },
    { name: 'subtract: token and token', fn: () => subtract(token, other) },
    { name: 'subtract: token and number', fn: () => subtract(token, 4) },
    { name: 'subtract: literal numbers', fn: () => subtract(12, 4) },
    { name: 'subtract: literal lengths', fn: () => subtract('12px', '4px') },
    { name: 'negate: token', fn: () => negate(token) },
    { name: 'negate: literal number', fn: () => negate(8) },
    { name: 'negate: literal length', fn: () => negate('8px') },
  ])
})

it('alpha', async (context) => {
  await runGroup(context, 'alpha', [
    { name: 'alpha: token', fn: () => alpha(color, 0.5) },
    { name: 'alpha: literal hex colour', fn: () => alpha('#1b5fd1', 0.5) },
    { name: 'alpha: literal named colour', fn: () => alpha('rebeccapurple', 0.5) },
  ])
})
