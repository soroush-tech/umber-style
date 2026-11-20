import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

// A page that is not found: the not-found state of the nested layout shows.
export default function MissingPage(): never {
  notFound()
}
