import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Bell, Search, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useCommentsSidebar } from "@/contexts/CommentsSidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
interface LayoutProps {
  children: React.ReactNode;
}
function LayoutContent({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { setOpen: setNavSidebarOpen } = useSidebar();
  const { isCommentsOpen } = useCommentsSidebar();
  const isMobile = useIsMobile();
  
  // Auto-close navigation sidebar when comments sidebar opens
  useEffect(() => {
    if (isCommentsOpen) {
      setNavSidebarOpen(false);
    }
  }, [isCommentsOpen, setNavSidebarOpen]);
  const getInitials = (email: string | undefined) => {
    if (!email) return "U";
    const username = email.split('@')[0];
    return username.slice(0, 2).toUpperCase();
  };
  const getDisplayName = (email: string | undefined) => {
    if (!email) return "User";
    return email.split('@')[0];
  };
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Desktop Sidebar - Hidden on mobile */}
        {!isMobile && <AppSidebar />}
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className={cn(
            "h-16 border-b border-border bg-card flex items-center justify-between shadow-soft",
            isMobile ? "px-4" : "px-6"
          )}>
            <div className="flex items-center gap-4">
              {!isMobile && (
                <SidebarTrigger className="p-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all hover:scale-105 shadow-md hover:shadow-lg" />
              )}
              <div className="relative">
                
                
              </div>
            </div>

            <div className="flex items-center gap-4">
              {!isMobile && (
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="w-5 h-5" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full flex items-center justify-center">
                    <span className="text-xs text-destructive-foreground font-bold">3</span>
                  </div>
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getInitials(user?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline">
                      {getDisplayName(user?.email)}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {getDisplayName(user?.email)}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Đăng xuất</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Content */}
          <main className={cn(
            "flex-1 overflow-auto",
            isMobile ? "pb-20 p-4" : "p-6"
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