// The program of `designSystem.tsx` without its code: the same modules of the engine, imported by
// name and not used. `check-type-cost.mjs` subtracts what the checker does here, so the budget counts
// the shapes of the design system alone, not the engine's own source.
export type {
  CreateStyled,
  CreateStyledComponent,
  FilteringStyledOptions,
  Interpolation,
  PropsOf,
  StyledOptions,
} from '../src/index'
export { styled } from '../src/index'
