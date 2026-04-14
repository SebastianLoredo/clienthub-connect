

## Plan: Add Totum logo to dashboard sidebar

Add the Totum logo at the top of the sidebar, using `SidebarHeader`. When collapsed, show a smaller version; when expanded, show the full logo.

### Changes

**`src/components/AppSidebar.tsx`**:
1. Import `SidebarHeader` from sidebar UI and `totumLogo` from `@/assets/totumlogo.png`
2. Add a `<SidebarHeader>` before `<SidebarContent>` containing the logo image
3. When collapsed, show a compact version (small square); when expanded, show full-width logo

