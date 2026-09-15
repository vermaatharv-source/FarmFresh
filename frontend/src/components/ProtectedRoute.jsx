import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Maps a role to where it should land instead of a route it's not allowed on.
const roleHome = (role) => {
  if (role === 'farmer') return '/farmer-dashboard';
  if (role === 'fpo_admin' || role === 'fpo_staff') return '/fpo/dashboard';
  return '/consumer-dashboard';
};

/**
 * Wrap any route that requires login with this.
 * - No logged-in user -> redirect to /login
 * - allowedRoles passed but user's role isn't in it -> redirect to their own dashboard
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return children;
}
