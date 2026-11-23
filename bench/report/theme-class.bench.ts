// One operation: see `themeClass` in ../gate/scenarios.ts (a theme class of a large theme the engine has not seen). One case for each version of
// versions.json, installed from npm (support.ts).
import { themeClass } from '../gate/scenarios'
import { createReport } from './support'

export default createReport(themeClass)
