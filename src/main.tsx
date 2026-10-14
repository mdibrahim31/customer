import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { DeliveryProvider } from './context/DeliveryContext';
import { CustomerPortal } from './components/customer/CustomerPortal';
import './index.css';

console.log('📦 foodiplace: Customer App Initializing...');

const StandaloneCustomerApp: React.FC = () => {
  return (
    <AppErrorBoundary>
      <DeliveryProvider>
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative">
          <main className="flex-1">
            <CustomerPortal />
          </main>
        </div>
      </DeliveryProvider>
    </AppErrorBoundary>
  );
};

console.log('🚀 foodiplace: Customer App Rendering to DOM...');
createRoot(document.getElementById('root')!).render(<StandaloneCustomerApp />);

// Register Service Worker for PWA / WebAPK installability and offline support
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', window.location.href).href;
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        console.log('✅ Customer PWA/WebAPK Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('Customer Service Worker registration notice:', err);
      });
  });
}
