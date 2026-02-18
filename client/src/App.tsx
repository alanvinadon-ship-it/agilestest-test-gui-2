import { Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProjectProvider } from "./state/projectStore";
import { DatasetStorageProvider } from "./contexts/DatasetStorageContext";
import DashboardLayout from "./components/DashboardLayout";
import { RequireProject } from "./components/RequireProject";
import { RequireProjectAccess } from "./components/RequireProjectAccess";
import type { ReactNode } from "react";

// ─── Pages ──────────────────────────────────────────────────────────────────
import LoginPage from "./pages/LoginPage";
import Home from "./pages/Home";
import ProjectsPage from "./pages/ProjectsPage";
import ProfilesPage from "./pages/ProfilesPage";
import ScenariosPage from "./pages/ScenariosPage";
import DatasetsPage from "./pages/DatasetsPage";
import ExecutionsPage from "./pages/ExecutionsPage";
import ExecutionDetailPage from "./pages/ExecutionDetailPage";
import CapturesPage from "./pages/CapturesPage";
import ProbesPage from "./pages/ProbesPage";
import DatasetTypesPage from "./pages/DatasetTypesPage";
import BundlesPage from "./pages/BundlesPage";
import GeneratedScriptsPage from "./pages/GeneratedScriptsPage";
import DocsPage from "./pages/DocsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminProjectAccessPage from "./pages/AdminProjectAccessPage";
import AdminRbacPage from "./pages/AdminRbacPage";
import AdminAuditPage from "./pages/AdminAuditPage";
import AdminRolesPage from "./pages/AdminRolesPage";
import DriveCampaignsPage from "./pages/DriveCampaignsPage";
import DriveReportingPage from "./pages/DriveReportingPage";

// ─── Query Client ───────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Auth Guards ────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-heading font-bold text-foreground mb-2">403</h2>
        <p className="text-sm text-muted-foreground">Accès réservé aux administrateurs.</p>
      </div>
    );
  }
  return <>{children}</>;
}

/** Combines RequireProject + RequireProjectAccess for project-scoped routes */
function ProjectScoped({ children }: { children: ReactNode }) {
  return (
    <RequireProject>
      <RequireProjectAccess>
        {children}
      </RequireProjectAccess>
    </RequireProject>
  );
}

// ─── Router ─────────────────────────────────────────────────────────────────
function AppRouter() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      {/* Login */}
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <LoginPage />}
      </Route>

      {/* Authenticated routes */}
      <Route>
        <RequireAuth>
          <DashboardLayout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/projects" component={ProjectsPage} />

              {/* Project-scoped pages (membership required) */}
              <Route path="/profiles">
                <ProjectScoped><ProfilesPage /></ProjectScoped>
              </Route>
              <Route path="/scenarios">
                <ProjectScoped><ScenariosPage /></ProjectScoped>
              </Route>
              <Route path="/datasets">
                <ProjectScoped><DatasetsPage /></ProjectScoped>
              </Route>
              <Route path="/dataset-types">
                <ProjectScoped><DatasetTypesPage /></ProjectScoped>
              </Route>
              <Route path="/bundles">
                <ProjectScoped><BundlesPage /></ProjectScoped>
              </Route>
              <Route path="/scripts">
                <ProjectScoped><GeneratedScriptsPage /></ProjectScoped>
              </Route>
              <Route path="/executions">
                <ProjectScoped><ExecutionsPage /></ProjectScoped>
              </Route>
              <Route path="/executions/:id">
                <ProjectScoped><ExecutionDetailPage /></ProjectScoped>
              </Route>
              <Route path="/captures">
                <ProjectScoped><CapturesPage /></ProjectScoped>
              </Route>
              <Route path="/probes">
                <ProjectScoped><ProbesPage /></ProjectScoped>
              </Route>

              {/* Drive Test pages (project-scoped) */}
              <Route path="/drive/campaigns">
                <ProjectScoped><DriveCampaignsPage /></ProjectScoped>
              </Route>
              <Route path="/drive/reporting">
                <ProjectScoped><DriveReportingPage /></ProjectScoped>
              </Route>

              {/* Admin pages */}
              <Route path="/admin/users">
                <RequireAdmin><AdminUsersPage /></RequireAdmin>
              </Route>
              <Route path="/admin/project-access">
                <RequireAdmin><AdminProjectAccessPage /></RequireAdmin>
              </Route>
              <Route path="/admin/roles">
                <RequireAdmin><AdminRolesPage /></RequireAdmin>
              </Route>
              <Route path="/admin/rbac">
                <RequireAdmin><AdminRbacPage /></RequireAdmin>
              </Route>
              <Route path="/admin/audit">
                <RequireAdmin><AdminAuditPage /></RequireAdmin>
              </Route>
              <Route path="/docs/:slug" component={DocsPage} />
              <Route path="/docs">
                <DocsPage />
              </Route>

              {/* 404 fallback */}
              <Route>
                <div className="text-center py-24">
                  <h2 className="text-2xl font-heading font-bold text-foreground mb-2">404</h2>
                  <p className="text-sm text-muted-foreground">Page introuvable.</p>
                </div>
              </Route>
            </Switch>
          </DashboardLayout>
        </RequireAuth>
      </Route>
    </Switch>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="agilestest-theme">
        <AuthProvider>
          <ProjectProvider>
            <DatasetStorageProvider>
              <AppRouter />
              <Toaster />
            </DatasetStorageProvider>
          </ProjectProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
