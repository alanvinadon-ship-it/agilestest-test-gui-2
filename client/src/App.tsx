import { Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProjectProvider } from "./state/projectStore";
import { DatasetStorageProvider } from "./contexts/DatasetStorageContext";
import DashboardLayout from "./components/DashboardLayout";
import { RequireProject } from "./components/RequireProject";
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

// ─── Auth Guard ─────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <>{children}</>;
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

              {/* Project-scoped pages */}
              <Route path="/profiles">
                <RequireProject><ProfilesPage /></RequireProject>
              </Route>
              <Route path="/scenarios">
                <RequireProject><ScenariosPage /></RequireProject>
              </Route>
              <Route path="/datasets">
                <RequireProject><DatasetsPage /></RequireProject>
              </Route>
              <Route path="/dataset-types">
                <RequireProject><DatasetTypesPage /></RequireProject>
              </Route>
              <Route path="/bundles">
                <RequireProject><BundlesPage /></RequireProject>
              </Route>
              <Route path="/scripts">
                <RequireProject><GeneratedScriptsPage /></RequireProject>
              </Route>
              <Route path="/executions">
                <RequireProject><ExecutionsPage /></RequireProject>
              </Route>
              <Route path="/executions/:id">
                <RequireProject><ExecutionDetailPage /></RequireProject>
              </Route>
              <Route path="/captures">
                <RequireProject><CapturesPage /></RequireProject>
              </Route>
              <Route path="/probes" component={ProbesPage} />

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
