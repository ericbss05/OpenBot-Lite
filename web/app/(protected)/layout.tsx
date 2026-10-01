import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider
    style={
    {
      "--sidebar-width": "18rem",
    } as React.CSSProperties
  }
    >
      <AppSidebar />
      <SidebarInset>
        {/* Le contenu de vos différentes pages s'affichera ici */}
        <div className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}