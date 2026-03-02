import { Switch, Route, Redirect } from "wouter";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProjectProvider } from "./state/projectStore";
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
import ProbesMonitoringPage from "./pages/ProbesMonitoringPage";
import DatasetTypesPage from "./pages/DatasetTypesPage";
import BundlesPage from "./pages/BundlesPage";
import GeneratedScriptsPage from "./pages/GeneratedScriptsPage";
import DocsPage from "./pages/DocsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminProjectAccessPage from "./pages/AdminProjectAccessPage";
import AdminRbacPage from "./pages/AdminRbacPage";
import AdminAuditPage from "./pages/AdminAuditPage";
import AdminRolesPage from "./pages/AdminRolesPage";
import AdminNotificationsPage from "./pages/AdminNotificationsPage";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DriveCampaignsPage from "./pages/DriveCampaignsPage";
import DriveReportingPage from "./pages/DriveReportingPage";
import DriveIncidentReportPage from "./pages/DriveIncidentReportPage";
import ProjectSettingsPage from "./pages/ProjectSettingsPage";
import DashboardPage from "./pages/DashboardPage";
import WebhooksPage from "./pages/WebhooksPage";
import CollectorDashboardPage from "./pages/CollectorDashboardPage";
import ScenarioTemplatesPage from "./pages/ScenarioTemplatesPage";
import CompareExecutionsPage from "./pages/CompareExecutionsPage";
import GlobalAnalyticsPage from "./pages/GlobalAnalyticsPage";
import ImportExportPage from "./pages/ImportExportPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import AdminBrandingPage from "./pages/AdminBrandingPage";
import AiSettingsPage from "./pages/AiSettingsPage";
import KeycloakConfigPage from "./pages/admin/KeycloakConfigPage";
import DriveRunsPage from "./pages/DriveRunsPage";
import DriveRunDetailPage from "./pages/DriveRunDetailPage";

// ─── Auth Guards ────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
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
  const { isAuthenticated, loading } = useAuth();

  return (
    <Switch>
      {/* Login */}
      <Route path="/login">
        {loading ? null : isAuthenticated ? <Redirect to="/" /> : <LoginPage />}
      </Route>

      {/* Invitation acceptance (public, no auth required) */}
      <Route path="/invite/accept">
        <AcceptInvitePage />
      </Route>

      {/* Password reset flow (public, no auth required) */}
      <Route path="/forgot-password">
        <ForgotPasswordPage />
      </Route>
      <Route path="/reset-password">
        <ResetPasswordPage />
      </Route>

      {/* Authenticated routes */}
      <Route>
        <RequireAuth>
          <DashboardLayout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/analytics" component={GlobalAnalyticsPage} />
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
              <Route path="/executions-compare">
                <ProjectScoped><CompareExecutionsPage /></ProjectScoped>
              </Route>
              <Route path="/captures">
                <ProjectScoped><CapturesPage /></ProjectScoped>
              </Route>
              <Route path="/probes">
                <ProjectScoped><ProbesPage /></ProjectScoped>
              </Route>
              <Route path="/webhooks">
                <ProjectScoped><WebhooksPage /></ProjectScoped>
              </Route>
              <Route path="/probes/monitoring">
                <ProjectScoped><ProbesMonitoringPage /></ProjectScoped>
              </Route>
              <Route path="/collector">
                <ProjectScoped><CollectorDashboardPage /></ProjectScoped>
              </Route>
              <Route path="/templates">
                <ScenarioTemplatesPage />
              </Route>
              <Route path="/import-export">
                <ImportExportPage />
              </Route>

              {/* Project settings */}
              <Route path="/settings">
                <ProjectScoped><ProjectSettingsPage /></ProjectScoped>
              </Route>

              {/* Drive Test pages (project-scoped) */}
              <Route path="/drive/campaigns">
                <ProjectScoped><DriveCampaignsPage /></ProjectScoped>
              </Route>
              <Route path="/drive/reporting">
                <ProjectScoped><DriveReportingPage /></ProjectScoped>
              </Route>
              <Route path="/drive/incidents/:id">
                <ProjectScoped><DriveIncidentReportPage /></ProjectScoped>
              </Route>
              <Route path="/drive/runs">
                <ProjectScoped><DriveRunsPage /></ProjectScoped>
              </Route>
              <Route path="/drive/runs/:uid">
                <ProjectScoped><DriveRunDetailPage /></ProjectScoped>
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
              <Route path="/admin/notifications">
                <RequireAdmin><AdminNotificationsPage /></RequireAdmin>
              </Route>
              <Route path="/admin/branding">
                <RequireAdmin><AdminBrandingPage /></RequireAdmin>
              </Route>
              <Route path="/admin/ai-settings">
                <RequireAdmin><AiSettingsPage /></RequireAdmin>
              </Route>
              <Route path="/admin/keycloak">
                <RequireAdmin><KeycloakConfigPage /></RequireAdmin>
              </Route>
              <Route path="/docs/:slug" component={DocsPage} />
              <Route path="/docs">
                <DocsPage />
              </Route>

              {/* Account settings */}
              <Route path="/account" component={AccountSettingsPage} />

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
    <ThemeProvider defaultTheme="dark" storageKey="agilestest-theme">
      <AuthProvider>
        <ProjectProvider>
          <AppRouter />
          <Toaster />
        </ProjectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
