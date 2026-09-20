import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ConsumerDashboard from './pages/ConsumerDashboard';
import FpoDashboard from './pages/FpoDashboard';
import TraceabilityPassport from './pages/TraceabilityPassport';
import FpoListingDetail from './pages/FpoListingDetail';
import AdminDashboard from './pages/AdminDashboard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/consumer-dashboard"
        element={
          <ProtectedRoute allowedRoles={['consumer']}>
            <ConsumerDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="/listing/:id" element={<FpoListingDetail />} />

      <Route
        path="/fpo/dashboard"
        element={
          <ProtectedRoute allowedRoles={['fpo_admin', 'fpo_staff']}>
            <FpoDashboard />
          </ProtectedRoute>
        }
      />

      {/* Authority / Government read-only portal */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="/trace/:batchId" element={<TraceabilityPassport />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
    </Routes>
  );
}

export default App;
