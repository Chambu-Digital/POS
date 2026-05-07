import BarPage from '@/components/bar/page'
import { ModuleGuard } from '@/components/auth/module-guard'

export default function BarRoute() {
  return (
    <ModuleGuard featureKey="bar.tabs">
      <BarPage />
    </ModuleGuard>
  )
}
