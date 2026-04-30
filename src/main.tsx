import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChainProvider } from './providers/ChainProvider';
import { WalletProvider } from './providers/WalletProvider';
import App from './App.tsx';
import './index.css';
import './styles/wallet-override.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChainProvider>
      <WalletProvider>
        <App />
      </WalletProvider>
    </ChainProvider>
  </StrictMode>
);
