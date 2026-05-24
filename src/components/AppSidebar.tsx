import { Users, Briefcase, FileText, FileSpreadsheet, LogOut, UserCog, ShieldAlert } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import totumLogo from "@/assets/totumlogo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Mis Clientes", url: "/dashboard/clientes", icon: Users },
  { title: "Puestos Tipo", url: "/dashboard/puestos-tipo", icon: Briefcase },
  { title: "Comparativas", url: "/dashboard/comparativas", icon: FileText },
  { title: "Reportes", url: "/dashboard/reportes", icon: FileSpreadsheet },
  { title: "Usuarios", url: "/dashboard/usuarios", icon: UserCog },
];

const adminItems = [
  { title: "Logs de Auditoría", url: "/dashboard/admin/logs", icon: ShieldAlert },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const nombre = user?.displayName || user?.email?.split("@")[0] || "";
  const visibleItems = isAdmin ? [...items, ...adminItems] : items;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex items-center justify-center p-4">
        <img
          src={totumLogo}
          alt="Totum Talent"
          className={collapsed ? "h-8 w-8 object-contain" : "h-10 w-auto object-contain"}
        />
      </SidebarHeader>
      <SidebarContent>
        {!collapsed && nombre && (
          <div className="px-3 pt-2 pb-1 text-sm font-medium text-sidebar-foreground">
            Hola {nombre}
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && "Menú Principal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={false}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={logout}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
