// One operation: see `extractPage` in ../gate/scenarios.ts (the CSS of one page of ten). One case for each version of
// versions.json, installed from npm (support.ts).
import { extractPage } from '../gate/scenarios'
import { createReport } from './support'

export default createReport(extractPage)
