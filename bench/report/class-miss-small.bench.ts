// One operation: see `classMissSmall` in ../gate/scenarios.ts (a small style the cache has not seen). One case for each version of
// versions.json, installed from npm (support.ts).
import { classMissSmall } from '../gate/scenarios'
import { createReport } from './support'

export default createReport(classMissSmall)
