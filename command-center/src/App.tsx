import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider, useAuth } from '@/lib/auth';
import { setUnauthorizedHandler } from '@/lib/api-client';
import { EvidenceProvider } from '@/components/EvidenceDrawer';
import { LoginScreen } from '@/components/LoginScreen';
import { Layout } from '@/components/Layout';

import { TodayPage } from '@/routes/TodayPage';
import { PlanPage } from '@/routes/PlanPage';
import { ApprovalsPage } from '@/routes/ApprovalsPage';
import { ActionsPage } from '@/routes/ActionsPage';
import { GovernancePage } from '@/routes/GovernancePage';
import { GoalsPage } from '@/routes/GoalsPage';
import { GoalDetailPage } from '@/routes/GoalDetailPage';
import { ProjectsPage } from '@/routes/ProjectsPage';
import { ProjectDetailPage } from '@/routes/ProjectDetailPage';
import { TasksPage } from '@/routes/TasksPage';
import { TaskDetailPage } from '@/routes/TaskDetailPage';
import { KnowledgePage } from '@/routes/KnowledgePage';
import { DocumentDetailPage } from '@/routes/DocumentDetailPage';
import { MemoryPage } from '@/routes/MemoryPage';
import { CalendarPage } from '@/routes/CalendarPage';
import { InboxPage } from '@/routes/InboxPage';
import { CodingPage } from '@/routes/CodingPage';
import { HealthPage } from '@/routes/HealthPage';
import { ReviewsPage } from '@/routes/ReviewsPage';
import { SettingsPage } from '@/routes/SettingsPage';

function Gate() {
  const { state, lock } = useAuth();

  useEffect(() => {
    setUnauthorizedHandler(lock);
    return () => setUnauthorizedHandler(null);
  }, [lock]);

  if (state !== 'authenticated') return <LoginScreen />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/today/plan" element={<PlanPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/actions" element={<ActionsPage />} />
        <Route path="/governance" element={<GovernancePage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/goals/:id" element={<GoalDetailPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/knowledge/documents/:id" element={<DocumentDetailPage />} />
        <Route path="/memory" element={<MemoryPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/coding" element={<CodingPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EvidenceProvider>
          <BrowserRouter basename="/command-center">
            <Gate />
          </BrowserRouter>
        </EvidenceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
