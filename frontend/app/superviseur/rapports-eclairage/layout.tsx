import ModuleEclairageGuard from '@/components/modules/ModuleEclairageGuard'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ModuleEclairageGuard>{children}</ModuleEclairageGuard>
}
