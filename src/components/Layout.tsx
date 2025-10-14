import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useCommentsSidebar } from "@/contexts/CommentsSidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
interface LayoutProps {
  children: React.ReactNode;
}
function LayoutContent({ children }: LayoutProps) {
  const { setOpen: setNavSidebarOpen } = useSidebar();
  const { isCommentsOpen } = useCommentsSidebar();
  const isMobile = useIsMobile();
  
  // Auto-close navigation sidebar when comments sidebar opens
  useEffect(() => {
    if (isCommentsOpen) {
      setNavSidebarOpen(false);
    }
  }, [isCommentsOpen, setNavSidebarOpen]);
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Desktop Sidebar - Hidden on mobile */}
        {!isMobile && <AppSidebar />}
        
        <div className="flex-1 flex flex-col">
          {/* Main Content */}
          <main className={cn(
            "flex-1 overflow-auto",
            isMobile ? "pb-20" : ""
          )}>
            {children}
          </main>
          
          {/* Mobile Bottom Navigation */}
          {isMobile && <MobileBottomNav />}
        </div>
      </div>
    </SidebarProvider>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}