import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './beta/AuthContext';
import {
  BetaLoginPage,
  BetaOnboardingPage,
  BetaRegisterPage,
  BetaResetPasswordPage,
} from './beta/BetaAuthPages';
import { BetaWorkspace } from './beta/BetaWorkspace';
import { GlobalGeminiChatbot } from './components/GlobalGeminiChatbot';
import { OfflineIndicator } from './components/PWAInstallButton';
import { DemoWorkspace } from './demo/DemoWorkspace';
import { LandingPage } from './pages/LandingPage';

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        {mapsQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm flex items-center justify-center gap-3">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
            <button
              type="button"
              onClick={() => setMapsQuotaExceeded(false)}
              className="rounded px-2 py-0.5 text-[11px] font-semibold bg-amber-200/70 hover:bg-amber-300/80 text-amber-950 cursor-pointer shrink-0"
              aria-label="Dispensar aviso"
            >
              Fechar
            </button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* Preserved Atlântica Moda Demonstration Routes */}
          <Route path="/painel" element={<DemoWorkspace initialSection="painel" />} />
          <Route path="/demo" element={<DemoWorkspace initialSection="painel" />} />
          <Route path="/demo/login" element={<DemoWorkspace initialSection="login" />} />
          <Route path="/demo/cadastro" element={<DemoWorkspace initialSection="cadastro" />} />
          <Route path="/demo/planos" element={<DemoWorkspace initialSection="plano" />} />
          <Route path="/demo/*" element={<DemoWorkspace />} />

          {/* Beta SaaS Multi-Tenant Routes */}
          <Route path="/beta" element={<Navigate to="/beta/login" replace />} />
          <Route path="/beta/login" element={<BetaLoginPage />} />
          <Route path="/beta/cadastro" element={<BetaRegisterPage />} />
          <Route path="/beta/recuperar-senha" element={<BetaResetPasswordPage />} />
          <Route path="/beta/onboarding" element={<BetaOnboardingPage />} />
          <Route path="/beta/app/*" element={<BetaWorkspace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GlobalGeminiChatbot />
        <OfflineIndicator />
      </BrowserRouter>
    </AuthProvider>
  );
}
