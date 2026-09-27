import { Navigate, Route, Routes } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import { useAuthContext } from '@/context/useAuthContext';
import { appRoutes, authRoutes } from '@/routes/index';
import AdminLayout from '@/layouts/AdminLayout';
const BROKER_PATHS = ['/properties'];

const AppRouter = props => {
  const {
    user,
    isAuthenticated
  } = useAuthContext();
  const isBroker = user?.role === 'broker';
  const loginPath = isBroker ? '/auth/broker-sign-in' : '/auth/sign-in';
  return <Routes>
      {(authRoutes || []).map((route, idx) => <Route key={idx + route.name} path={route.path} element={<AuthLayout {...props}>{route.element}</AuthLayout>} />)}

      {(appRoutes || []).map((route, idx) => <Route key={idx + route.name} path={route.path} element={isAuthenticated ? isBroker && !BROKER_PATHS.includes(route.path) ? <Navigate to="/properties" replace /> : <AdminLayout {...props}>{route.element}</AdminLayout> : <Navigate to={{
      pathname: loginPath,
      search: 'redirectTo=' + route.path
    }} />} />)}
    </Routes>;
};
export default AppRouter;