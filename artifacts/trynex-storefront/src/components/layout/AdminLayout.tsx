import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, ShoppingCart, Settings, LogOut, Menu, X, FileText, Users, HardDrive, Sparkles, Star, Code2, BookOpen, Paintbrush, GitBranch, Gift, Layers, History, Shield, Search, Tag, Share2, Mail } from "lucide-react";
import { useAdminLogout, useAdminMe } from "@workspace/api-client-react";
import React, { useEffect, useState } from "react";
import { Loader } from "@/components/ui/Loader";
import { cn, getAuthHeaders } from "@/lib/utils";
import { AdminAIAssistant } from "@/components/AdminAIAssistant";

const MENU: { name: string; href: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { name: "Products", href: "/admin/products", icon: Package },
  { name: "Categories", href: "/admin/categories", icon: Layers },
  { name: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { name: "Page Designer", href: "/admin/designer", icon: Paintbrush },
  { name: "Gift Hampers", href: "/admin/hampers", icon: Gift },
  { name: "Social Import", href: "/admin/facebook-import", icon: Sparkles },
  { name: "Reviews", href: "/admin/reviews", icon: Star },
  { name: "Blog Posts", href: "/admin/blog", icon: FileText },
  { name: "Customers", href: "/admin/customers", icon: Users },
  { name: "Backup", href: "/admin/backup", icon: HardDrive },
  { name: "FB Import Guide", href: "/admin/facebook-guide", icon: BookOpen },
  { name: "Tech Stack", href: "/admin/tech-stack", icon: Code2 },
  { name: "Deployment", href: "/admin/deployment", icon: GitBranch },
  { name: "SEO / Search Console", href: "/admin/seo", icon: Search },
  { name: "Promo Codes", href: "/admin/promo-codes", icon: Tag },
  { name: "Referrals", href: "/admin/referrals", icon: Share2 },
  { name: "Newsletter", href: "/admin/newsletter", icon: Mail },
  { name: "Activity Log", href: "/admin/logs", icon: History },
  { name: "Security", href: "/admin/security", icon: Shield },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const token = sessionStorage.getItem('trynex_admin_token');
  const authOpts = { request: { headers: getAuthHeaders() } };

  const { data, isPending, isFetching, isError } = useAdminMe(authOpts);
  const { mutateAsync: logout } = useAdminLogout(authOpts);

  useEffect(() => {
    if (!token) {
      setLocation("/admin/login");
      return;
    }
    // Only redirect on auth failure once the query has settled (not while
    // a fetch/refetch is in progress). This prevents the redirect loop that
    // happens when a cached 401 error is being replaced by a fresh fetch
    // after login.
    if (!isPending && !isFetching && (isError || (data && !data.admin))) {
      sessionStorage.removeItem('trynex_admin_token');
      setLocation("/admin/login");
    }
  }, [isPending, isFetching, isError, data, setLocation, token]);

  const handleLogout = async () => {
    sessionStorage.removeItem('trynex_admin_token');
    await logout().catch(() => {});
    setLocation("/admin/login");
  };

  if (!token || isPending || isFetching) return <Loader fullScreen />;
  if (isError || !data?.admin) return <Loader fullScreen />;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 bg-white border-r border-gray-100 shadow-sm",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(150deg, #1E1508 0%, #2C1E0E 100%)',
                boxShadow: '0 0 0 1px rgba(212,160,23,0.5), 0 3px 10px rgba(0,0,0,0.2)',
              }}>
              <svg width="18" height="18" viewBox="0 0 26 26" fill="none" aria-hidden="true">
                <path d="M6 9h14" stroke="#D4A017" strokeWidth="2.6" strokeLinecap="round"/>
                <path d="M13 9v11" stroke="#D4A017" strokeWidth="2.6" strokeLinecap="round"/>
                <path d="M21 4 L21.8 6.2 L24 7 L21.8 7.8 L21 10 L20.2 7.8 L18 7 L20.2 6.2 Z" fill="#FFD966"/>
              </svg>
            </div>
            <div className="leading-none">
              <span className="font-black font-display text-lg text-gray-900">TRY<span style={{ color: '#E85D04' }}>NEX</span></span>
              <span className="block text-[9px] font-bold text-gray-400 tracking-widest uppercase mt-0.5">Admin Panel</span>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {MENU.map(item => {
            const Icon = item.icon;
            const active = item.exact ? location === item.href : (location === item.href || location.startsWith(item.href + "/"));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200",
                  active
                    ? "text-white shadow-md"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                )}
                style={active ? {
                  background: 'linear-gradient(135deg, #E85D04, #FB8500)',
                  boxShadow: '0 4px 16px rgba(232,93,4,0.3)'
                } : {}}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all w-full"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 flex items-center gap-4 px-6 border-b border-gray-100 bg-white shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 text-gray-400 hover:text-gray-600"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <Link href="/" className="text-xs font-semibold text-gray-400 hover:text-orange-600 transition-colors mr-2">
            ← View Store
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white"
              style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
              A
            </div>
            <span className="text-sm font-semibold text-gray-600 hidden sm:block">Admin</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>

      {/* Floating AI Assistant — available on every admin page */}
      <AdminAIAssistant />
    </div>
  );
}
