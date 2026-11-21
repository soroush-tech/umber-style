export const dynamic = 'force-dynamic'

// A page that throws: the error state of the nested layout shows.
export default function BrokenPage(): never {
  throw new Error('The broken page of the fixture')
}
