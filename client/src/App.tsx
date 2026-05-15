import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "./lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import Home from "./pages/home";
import Login from "./pages/login";
import Register from "./pages/register";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";
import AdminPage from "./pages/admin";
import SubscriptionPage from "./pages/subscription";
import SubscriptionSuccessPage from "./pages/subscription-success";
import TutorPublic from "./pages/tutor-public";
import StudentsPage from "./pages/students";
import FinancePage from "./pages/finance";
import ProfilePage from "./pages/profile";
import LessonsPage from "./pages/lessons";
import SchedulePage from "./pages/schedule";
import CommPage from "./pages/comm";
import AIPage from "./pages/ai";
import AnalyticsPage from "./pages/analytics";
import HomeworkPage from "./pages/homework";
import QuizzesPage from "./pages/quizzes";
import RecordingsPage from "./pages/recordings";
import StudentPortal from "./pages/student-portal";
const BoardPage = lazy(() => import("./pages/board"));
import ConferencePage from "./pages/conference";
import BbbPage from "./pages/bbb";
import BoardsPage from "./pages/boards";
import HelpPage from "./pages/help";
import ChatPage from "./pages/chat";
import TasksPage from "./pages/tasks";
import OfertaPage from "./pages/legal/oferta";
import PrivacyPage from "./pages/legal/privacy";
import LessonPlanPage from "./pages/lesson-plan";
import LandingPage from "./pages/landing";
import VerifyEmailPage from "./pages/verify-email";
import ReferralsPage from "./pages/referrals";
import ParentChatPage from "./pages/parent-chat";
import ParentPaymentsPage from "./pages/parent-payments";
import CatalogPage from "./pages/catalog";
import ApplicationsPage from "./pages/applications";
import CertificatePage from "./pages/certificate";
import StudentForgotPassword from "./pages/student-forgot-password";
import StudentResetPassword from "./pages/student-reset-password";
import StudentVerifyEmail from "./pages/student-verify-email";
import { PageTransition } from "@/components/page-transition";
import { OnboardingWelcome } from "@/components/onboarding-welcome";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <ErrorBoundary variant="page">
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="text-sm text-muted-foreground">Загрузка...</div></div>}>
        <PageTransition>
          <Component />
        </PageTransition>
      </Suspense>
    </ErrorBoundary>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <ErrorBoundary variant="page">
      <PageTransition>
        <Component />
      </PageTransition>
    </ErrorBoundary>
  );
}

function HomeRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary variant="page">
        <LandingPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary variant="page">
      <Home />
    </ErrorBoundary>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login">{() => <PublicRoute component={Login} />}</Route>
      <Route path="/register">{() => <PublicRoute component={Register} />}</Route>
      <Route path="/forgot-password">{() => <PublicRoute component={ForgotPassword} />}</Route>
      <Route path="/reset-password">{() => <PublicRoute component={ResetPassword} />}</Route>
      <Route path="/verify-email">{() => <PublicRoute component={VerifyEmailPage} />}</Route>
      <Route path="/student/forgot-password">{() => <PublicRoute component={StudentForgotPassword} />}</Route>
      <Route path="/student/reset-password">{() => <PublicRoute component={StudentResetPassword} />}</Route>
      <Route path="/student/verify-email">{() => <PublicRoute component={StudentVerifyEmail} />}</Route>
      <Route path="/referrals">{() => <ProtectedRoute component={ReferralsPage} />}</Route>
      <Route path="/t/:slug">{() => <PublicRoute component={TutorPublic} />}</Route>
      <Route path="/catalog">{() => <PublicRoute component={CatalogPage} />}</Route>
      <Route path="/applications">{() => <ProtectedRoute component={ApplicationsPage} />}</Route>
      <Route path="/certificate/:studentId">{() => <ProtectedRoute component={CertificatePage} />}</Route>
      <Route path="/student/:rest*">{() => <PublicRoute component={StudentPortal} />}</Route>
      <Route path="/student">{() => <PublicRoute component={StudentPortal} />}</Route>
      <Route path="/parent-chat">{() => <PublicRoute component={ParentChatPage} />}</Route>
      <Route path="/parent/payments">{() => <PublicRoute component={ParentPaymentsPage} />}</Route>
      <Route path="/admin">{() => <ProtectedRoute component={AdminPage} />}</Route>
      <Route path="/subscription/success">{() => <PublicRoute component={SubscriptionSuccessPage} />}</Route>
      <Route path="/subscription">{() => <ProtectedRoute component={SubscriptionPage} />}</Route>
      <Route path="/students">{() => <ProtectedRoute component={StudentsPage} />}</Route>
      <Route path="/finance">{() => <ProtectedRoute component={FinancePage} />}</Route>
      <Route path="/profile">{() => <ProtectedRoute component={ProfilePage} />}</Route>
      <Route path="/lessons">{() => <ProtectedRoute component={LessonsPage} />}</Route>
      <Route path="/schedule">{() => <ProtectedRoute component={SchedulePage} />}</Route>
      <Route path="/comm">{() => <ProtectedRoute component={CommPage} />}</Route>
      <Route path="/ai">{() => <ProtectedRoute component={AIPage} />}</Route>
      <Route path="/analytics">{() => <ProtectedRoute component={AnalyticsPage} />}</Route>
      <Route path="/homework">{() => <ProtectedRoute component={HomeworkPage} />}</Route>
      <Route path="/quizzes">{() => <ProtectedRoute component={QuizzesPage} />}</Route>
      <Route path="/recordings">{() => <ProtectedRoute component={RecordingsPage} />}</Route>
      <Route path="/recording/:id">{() => <ProtectedRoute component={RecordingsPage} />}</Route>
      <Route path="/board/:studentId">{(params) => <ProtectedRoute key={params.studentId} component={BoardPage} />}</Route>
      <Route path="/conference">{() => <ProtectedRoute component={ConferencePage} />}</Route>
      <Route path="/bbb">{() => <ProtectedRoute component={BbbPage} />}</Route>
      <Route path="/boards">{() => <ProtectedRoute component={BoardsPage} />}</Route>
      <Route path="/help">{() => <ProtectedRoute component={HelpPage} />}</Route>
      <Route path="/chat">{() => <ProtectedRoute component={ChatPage} />}</Route>
      <Route path="/tasks">{() => <ProtectedRoute component={TasksPage} />}</Route>
      <Route path="/lesson-plan">{() => <ProtectedRoute component={LessonPlanPage} />}</Route>
      <Route path="/legal/oferta" component={OfertaPage} />
      <Route path="/legal/privacy" component={PrivacyPage} />
      <Route path="/" component={HomeRoute} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary variant="page">
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <ErrorBoundary variant="page">
              <Router />
            </ErrorBoundary>
            <OnboardingWelcome />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
