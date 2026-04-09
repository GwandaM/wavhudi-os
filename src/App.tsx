import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { TitleBar } from "@/components/planner/TitleBar";
import { FirstRunSetup } from "@/components/planner/FirstRunSetup";
import { CalendarEventsProvider } from "@/contexts/CalendarEventsContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

const Router = window.electronAPI ? HashRouter : BrowserRouter;

function useFirstRunCheck() {
  // null = loading, true = show setup, false = skip
  const [showSetup, setShowSetup] = useState<boolean | null>(
    window.electronAPI ? null : false
  );

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.appConfig.get("setup_completed").then((val) => {
      setShowSetup(val !== "true");
    });
  }, []);

  return { showSetup, complete: () => setShowSetup(false) };
}

const App = () => {
  const { showSetup, complete } = useFirstRunCheck();

  // Still loading setup state — render nothing to avoid a flash
  if (showSetup === null) return null;

  if (showSetup) {
    return <FirstRunSetup onComplete={complete} />;
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CalendarEventsProvider>
          <TitleBar />
          <Toaster />
          <Sonner />
          <Router>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </CalendarEventsProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
