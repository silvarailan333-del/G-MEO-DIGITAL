import React, { useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWA';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#20C5D5]/40 bg-[#20C5D5]/10 px-2.5 py-1 text-[11px] font-medium text-[#20C5D5] hover:bg-[#20C5D5]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Instalar Gêmeo Digital como aplicativo"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-[#20C5D5]" />
          <span className="hidden sm:inline">Instalar no iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  Instalar no iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-[var(--text-secondary)] hover:text-white cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-xs text-[var(--text-secondary)] leading-relaxed">
                1. Toque no botão <strong className="text-[var(--text-primary)]">Compartilhar</strong> na barra do Safari.
                <br />
                2. Role para baixo e selecione{' '}
                <strong className="text-[var(--text-primary)]">Adicionar à Tela de Início</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#20C5D5] py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-[#F2B84B]/40 bg-[#102B50] px-3 py-2 text-xs font-medium text-[#F2B84B] shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Modo offline — exibindo recursos em cache local.</span>
    </div>
  );
};
