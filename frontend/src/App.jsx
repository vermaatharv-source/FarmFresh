import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import FarmerDashboard from './pages/FarmerDashboard';
import ConsumerDashboard from './pages/ConsumerDashboard';
import FpoDashboard from './pages/FpoDashboard';
import TraceabilityPassport from './pages/TraceabilityPassport';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/farmer-dashboard"
        element={
          <ProtectedRoute allowedRoles={['farmer']}>
            <FarmerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consumer-dashboard"
        element={
          <ProtectedRoute allowedRoles={['consumer']}>
            <ConsumerDashboard />
          </ProtectedRoute>
        }
      />

      {/* FPO Portal & Public Traceability Routes */}
      <Route
        path="/fpo/dashboard"
        element={
          <ProtectedRoute allowedRoles={['fpo_admin', 'fpo_staff']}>
            <FpoDashboard />
          </ProtectedRoute>
        }
      />
      {/* Public — no login required, this is the QR-scan-facing passport page */}
      <Route path="/trace/:batchId" element={<TraceabilityPassport />} />
    </Routes>
  );
}

export default App;
