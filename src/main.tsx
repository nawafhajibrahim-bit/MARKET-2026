import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import './i18n'
import App from './App.tsx'
import { DbProvider } from './database/Provider.tsx'

const AppWrapper = () => {
  const [clientId, setClientId] = useState(() => {
    return localStorage.getItem('custom_google_client_id') || 
           import.meta.env.VITE_GOOGLE_CLIENT_ID || 
           '1234567890-placeholder.apps.googleusercontent.com';
  });

  useEffect(() => {
    const handleStorage = () => {
      const current = localStorage.getItem('custom_google_client_id') || 
                    import.meta.env.VITE_GOOGLE_CLIENT_ID || 
                    '1234567890-placeholder.apps.googleusercontent.com';
      setClientId(current);
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('google_client_id_changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('google_client_id_changed', handleStorage);
    };
  }, []);

  return (
    <GoogleOAuthProvider clientId={clientId} key={clientId}>
      <DbProvider>
        <App />
      </DbProvider>
    </GoogleOAuthProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>,
)
