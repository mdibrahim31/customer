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
