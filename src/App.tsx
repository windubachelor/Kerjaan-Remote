/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TasksPage } from './features/tasks/TasksPage';
import { PaidTasksPage } from './features/paid/PaidTasksPage';
import { WorksheetPage } from './features/worksheet/WorksheetPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TaskDetailDrawer } from './features/tasks/TaskDetailDrawer';
import { AddTaskDialog } from './features/tasks/AddTaskDialog';
import { CommandPalette } from './components/ui/CommandPalette';
import { ToastContainer } from './components/ui/ToastContainer';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/paid" element={<PaidTasksPage />} />
          <Route path="/worksheet" element={<WorksheetPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>

      {/* Global Interactive Overlays */}
      <TaskDetailDrawer />
      <AddTaskDialog />
      <CommandPalette />
      <ToastContainer />
    </BrowserRouter>
  );
}
