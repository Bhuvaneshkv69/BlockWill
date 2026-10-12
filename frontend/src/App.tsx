import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import WillsListPage from "@/pages/WillsListPage";
import CreateWillWizard from "@/pages/wills/CreateWillWizard";
import WillDetailPage from "@/pages/wills/WillDetailPage";
import BeneficiariesPage from "@/pages/BeneficiariesPage";
import ExecutorPage from "@/pages/ExecutorPage";
import WitnessPage from "@/pages/WitnessPage";
import VerificationPage from "@/pages/VerificationPage";
import DisputesPage from "@/pages/DisputesPage";
import BlockchainExplorerPage from "@/pages/BlockchainExplorerPage";
import DltNetworkPage from "@/pages/DltNetworkPage";
import DocumentsPage from "@/pages/DocumentsPage";
import AdminPage from "@/pages/AdminPage";
import SettingsPage from "@/pages/SettingsPage";
import DemoControlPanelPage from "@/pages/DemoControlPanelPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/wills" element={<WillsListPage />} />
        <Route path="/wills/create" element={<CreateWillWizard />} />
        <Route path="/wills/:id" element={<WillDetailPage />} />
        <Route path="/wills/:id/audit" element={<WillDetailPage initialTab="audit" />} />
        <Route path="/wills/:id/inheritance" element={<WillDetailPage initialTab="inheritance" />} />
        <Route path="/beneficiaries" element={<ProtectedRoute roles={["BENEFICIARY", "ADMIN"]}><BeneficiariesPage /></ProtectedRoute>} />
        <Route path="/executor" element={<ProtectedRoute roles={["EXECUTOR", "ADMIN"]}><ExecutorPage /></ProtectedRoute>} />
        <Route path="/witness" element={<ProtectedRoute roles={["WITNESS", "ADMIN"]}><WitnessPage /></ProtectedRoute>} />
        <Route path="/verification" element={<ProtectedRoute roles={["AUTHORITY", "ADMIN"]}><VerificationPage /></ProtectedRoute>} />
        <Route path="/disputes" element={<DisputesPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/blockchain" element={<BlockchainExplorerPage />} />
        <Route path="/dlt-network" element={<DltNetworkPage />} />
        <Route path="/admin" element={<ProtectedRoute roles={["ADMIN"]}><AdminPage /></ProtectedRoute>} />
        <Route path="/demo" element={<ProtectedRoute roles={["ADMIN"]}><DemoControlPanelPage /></ProtectedRoute>} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<Navigate to="/settings" replace />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
