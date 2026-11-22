// One operation: see `classMerge` in ../gate/scenarios.ts (merging five classes). One case for each version of
// versions.json, installed from npm (support.ts).
import { classMerge } from '../gate/scenarios'
import { createReport } from './support'

export default createReport(classMerge)
