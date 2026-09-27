import { deleteCookie, getCookie, setCookie } from 'cookies-next';
import { createContext, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
const AuthContext = createContext(undefined);
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
export const authSessionKey = '_REBACK_AUTH_KEY_';
export function AuthProvider({
  children
}) {
  const navigate = useNavigate();
  const getSession = () => {
    const fetchedCookie = getCookie(authSessionKey)?.toString();
    if (!fetchedCookie) return;else return JSON.parse(fetchedCookie);
  };
  const [user, setUser] = useState(getSession());
  const saveSession = user => {
    setCookie(authSessionKey, JSON.stringify(user), { path: '/' });
    setUser(user);
  };
  const removeSession = () => {
    const loginPath = user?.role === 'broker' ? '/auth/broker-sign-in' : '/auth/sign-in';
    deleteCookie(authSessionKey, { path: '/' });
    setUser(undefined);
    navigate(loginPath, { replace: true });
  };
  return <AuthContext.Provider value={{
    user,
    isAuthenticated: Boolean(user),
    saveSession,
    removeSession
  }}>
      {children}
    </AuthContext.Provider>;
}