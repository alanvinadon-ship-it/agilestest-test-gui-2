import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TestProvider } from "./contexts/TestContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import VabfPage from "./pages/VabfPage";
import SpanPage from "./pages/SpanPage";
import VabePage from "./pages/VabePage";
import ChecklistsPage from "./pages/ChecklistsPage";
import ConfigPage from "./pages/ConfigPage";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/vabf" component={VabfPage} />
        <Route path="/span" component={SpanPage} />
        <Route path="/vabe" component={VabePage} />
        <Route path="/checklists" component={ChecklistsPage} />
        <Route path="/config" component={ConfigPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TestProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </TestProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
