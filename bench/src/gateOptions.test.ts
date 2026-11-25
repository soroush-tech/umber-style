import { GATE_OPTIONS } from '../gate/baseline'
import { toCliArguments, toStepOutputs } from './gateOptions'

describe('the options of the gate', () => {
  it('are those the job has always given: the previous case, 80% and five rounds', () => {
    expect(GATE_OPTIONS).toEqual({ baselineCase: 'previous', minRatio: 80, rounds: 5 })
  })

  it('give the options of the soroush-bench CLI', () => {
    expect(toCliArguments(GATE_OPTIONS)).toEqual([
      '--baseline-case',
      'previous',
      '--min-ratio',
      '80',
      '--rounds',
      '5',
    ])
  })

  it('give the outputs of a step, named as the inputs of the action', () => {
    expect(toStepOutputs({ baselineCase: 'base', minRatio: 75.5, rounds: 3 })).toBe(
      'baseline-case=base\nmin-ratio=75.5\nrounds=3\n'
    )
  })
})
