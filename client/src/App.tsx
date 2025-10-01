import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";

// Admin pages
import AdminLogin from "@/pages/admin/login";
import HallTicketGeneration from "@/pages/admin/hall-ticket-generation";
import AdminDashboard from "@/pages/admin/dashboard";
import MonitoringSystem from "@/pages/admin/monitoring";
import IncidentManagement from "@/pages/admin/incidents";
import QuestionManagement from "@/pages/admin/question-management";
import Results from "@/pages/admin/results";
import DraftBin from "@/pages/admin/draft-bin";

// Student pages
import StudentAuthentication from "@/pages/student/authentication";
import SimpleIdentityVerification from "@/pages/student/simple-identity-verification";
import ExamMode from "@/pages/student/exam";
import ExamComplete from "@/pages/student/exam-complete";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Home route - conditional based on auth */}
      <Route path="/" component={isLoading || !isAuthenticated ? Landing : Home} />
      
      {/* Admin login route - always available */}
      <Route path="/admin/login" component={AdminLogin} />
      
      {/* Student routes - always available (they guard themselves) */}
      <Route path="/student/auth" component={StudentAuthentication} />
      <Route path="/hall-ticket" component={StudentAuthentication} />
      <Route path="/student/identity-verification" component={SimpleIdentityVerification} />
      <Route path="/student/exam" component={ExamMode} />
      <Route path="/exam-complete" component={ExamComplete} />
      
      {/* Admin routes - protected by auth */}
      {isAuthenticated && (
        <>
          <Route path="/admin" component={Home} />
          <Route path="/admin/hall-tickets" component={HallTicketGeneration} />
          <Route path="/admin/dashboard" component={AdminDashboard} />
          <Route path="/admin/monitoring" component={MonitoringSystem} />
          <Route path="/admin/incidents" component={IncidentManagement} />
          <Route path="/admin/questions" component={QuestionManagement} />
          <Route path="/admin/results" component={Results} />
          <Route path="/admin/draft-bin" component={DraftBin} />
        </>
      )}
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
