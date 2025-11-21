import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Meeting } from './pages/Meeting';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Loading } from './components/Common/Loading';
import { useUserStore } from './store';
import { useEffect } from 'react';
import { apiService } from './services';

function App() {
  const { isAuthenticated, isLoading, setUser, setLoading } = useUserStore();

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        setLoading(true);
        try {
          const user = await apiService.getMe();
          setUser(user);
        } catch (error) {
          // Token invalid or expired, clear it
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          setUser(null);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, [setUser, setLoading]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return <Loading message="Checking authentication..." />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes - redirect to home if already authenticated */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" /> : <Login />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/" /> : <Register />}
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={isAuthenticated ? <Home /> : <Navigate to="/login" />}
        />
        <Route
          path="/meeting/:meetingCode"
          element={isAuthenticated ? <Meeting /> : <Navigate to="/login" />}
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
