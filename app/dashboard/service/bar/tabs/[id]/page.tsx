import { ModuleGuard } from '@/components/auth/module-guard'
import { TabDetailPage } from '@/components/bar/TabDetailPage'

// Canonical Service → Bar → Tab Detail route.
// Mirrors app/dashboard/bar/tabs/[id]/page.tsx exactly.
export default async function ServiceBarTabDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <ModuleGuard featureKey="bar.tabs">
      <TabDetailPage tabId={id} />
    </ModuleGuard>
  )
}
