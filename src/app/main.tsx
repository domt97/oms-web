import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SellerApp } from '../features/seller/SellerApp';
import { StorefrontApp } from '../features/storefront/StorefrontApp';
import { ServicesProvider } from '../shared/lib/services';
import { isUnder, useLocation } from '../shared/lib/router';
import '../shared/ui/styles.css';
import { ErrorBoundary } from '../shared/ui/ui';
import { readConfig } from './config';
import { createServices } from './services';

const services = createServices(readConfig());

/** Two apps, one bundle: /seller/** is the Seller Centre, everything else is the storefront. */
function Root() {
  const { path } = useLocation();
  return isUnder(path, '/seller') ? <SellerApp /> : <StorefrontApp />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ServicesProvider services={services}>
        <Root />
      </ServicesProvider>
    </ErrorBoundary>
  </StrictMode>,
);
