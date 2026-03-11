import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { TooltipProvider } from './components/ui/tooltip.tsx';
import { Toaster } from './components/ui/toaster.tsx';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <App />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
