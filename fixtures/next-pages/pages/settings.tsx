import { SettingsPage } from '@umber-fixtures/shared/pages'

export default function Page() {
  return <SettingsPage />
}

// Rendered on each request, by the one server process: the style cache outlives the request.
export const getServerSideProps = async () => ({ props: {} })
