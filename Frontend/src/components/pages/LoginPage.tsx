import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToasts } from '../../hooks/useToasts';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import { APP_TITLE, ROUTES } from '../../constants';
import { useNavigate } from 'react-router-dom';
import { useSync } from '../../hooks/useSync';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); 
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, isAuthLoading } = useAuth(); 
  const { addToast } = useToasts();
  const { runBootstrap } = useSync();
  const navigate = useNavigate();

  useEffect(() => {
    // If auth is not loading and user is already authenticated, redirect away from login
    if (!isAuthLoading && isAuthenticated) {
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
  }, [isAuthenticated, isAuthLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await login(username, password);
    if (!success) {
      const errorMessage = 'Usuario o contraseña inválidos. (Pista: adm/pass)';
      setError(errorMessage); 
      addToast(errorMessage, 'error');
    } else {
      await runBootstrap();
      // Success toast can be omitido aquí si login function o navigation implica éxito
      // addToast(`Bienvenido ${username}!`, 'success'); 
    }
    setLoading(false);
  };

  // While checking auth status, or if already authenticated (and about to be redirected),
  // show a loading screen to prevent login form flash.
  if (isAuthLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sap-blue to-blue-700 p-4">
        <p className="text-xl text-white">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sap-blue to-blue-700 p-4">
      <Card className="w-full max-w-md"> 
        <div className="text-center mb-8">
          <img src="imagens/Mini_Zer0x.jpg" alt="Zer0x Logo" className="mx-auto mb-4 h-12"/>
          <h2 className="text-2xl font-bold text-sap-dark-gray dark:text-gray-100">{APP_TITLE}</h2>
          <p className="text-sap-medium-gray dark:text-gray-400">Jaime O. Mella V.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Usuario"
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="e.j., adm"
          />
          <Input
            label="Clave"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="e.j., pass"
          />
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;