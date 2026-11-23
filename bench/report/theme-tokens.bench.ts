// One operation: see `themeTokens` in ../gate/scenarios.ts (the tokens and declarations of the large theme). One case for each version of
// versions.json, installed from npm (support.ts).
import { themeTokens } from '../gate/scenarios'
import { createReport } from './support'

export default createReport(themeTokens)
