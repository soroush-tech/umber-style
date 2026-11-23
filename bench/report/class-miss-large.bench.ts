// One operation: see `classMissLarge` in ../gate/scenarios.ts (a large style the cache has not seen). One case for each version of
// versions.json, installed from npm (support.ts).
import { classMissLarge } from '../gate/scenarios'
import { createReport } from './support'

export default createReport(classMissLarge)
