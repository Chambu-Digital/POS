import { ModuleGuard } from '@/components/auth/module-guard'
import { TabDetailPage } from '@/components/bar/TabDetailPage'

export default async function TabDetailRoute({
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
