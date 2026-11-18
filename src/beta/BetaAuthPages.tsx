import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useBetaAuth } from './AuthContext';
import {
  ANNUAL_DISCOUNT_LABEL,
  PAYMENT_NOTICE_DEMO,
  PLANS_CONFIG,
  type BillingCycle,
  type PlanCode,
} from '../config/plans';

export const BetaBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1.5 rounded-md border border-[#20C5D5]/40 bg-[#20C5D5]/10 px-2 py-0.5 text-[11px] font-semibold text-[#20C5D5] whitespace-nowrap">
    BETA — Plataforma em fase de testes
  </span>
);

function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/email-already-in-use') return 'Este e-mail já está cadastrado.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'E-mail ou senha inválidos.';
  }
  if (code === 'auth/weak-password') return 'A senha deve ter no mínimo 6 caracteres.';
  if (code === 'auth/operation-not-allowed') {
    return 'Login por e-mail/senha ainda não está habilitado no Firebase Console deste projeto. Utilize "Continuar com Google" ou ative Email/Password no Firebase Console.';
  }
  if (code === 'auth/popup-closed-by-user') return 'Janela de login fechada antes da conclusão.';
  return err instanceof Error ? err.message : 'Erro ao autenticar.';
}

export const BetaLoginPage: React.FC = () => {
  const { signInWithEmail, signInWithGoogle } = useBetaAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      navigate('/beta/app/painel');
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigate('/beta/app/painel');
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Início</span>
          </Link>
          <BetaBadge />
        </div>

        <div className="flex items-center gap-3">
          <img
            src="/src/assets/images/gemeo_digital_icon_1794938598899.jpg"
            alt="Gêmeo Digital"
            className="h-10 w-10 rounded-lg object-cover border border-[#20C5D5]/30"
          />
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Entrar no Gêmeo Digital</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Acesse o ambiente privado da sua empresa.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-[#EF6464]/40 bg-[#EF6464]/10 p-3 text-xs text-[#EF6464]">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[#20C5D5]/50 transition-colors cursor-pointer"
        >
          <span>Continuar com Google</span>
        </button>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[var(--border-subtle)]" />
          <span className="shrink mx-3 text-[11px] text-[var(--text-secondary)]">ou use seu e-mail</span>
          <div className="flex-grow border-t border-[var(--border-subtle)]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@suaempresa.com.br"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#20C5D5]"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">Senha</label>
              <Link to="/beta/recuperar-senha" className="text-xs text-[#20C5D5] hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#20C5D5]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#20C5D5] py-2.5 text-sm font-semibold text-[#06132D] hover:bg-[#38d3e2] transition-colors cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="text-center text-xs text-[var(--text-secondary)] pt-3 border-t border-[var(--border-subtle)]">
          Ainda não tem conta?{' '}
          <Link to="/beta/cadastro" className="font-semibold text-[#20C5D5] hover:underline">
            Começar agora
          </Link>
        </div>
      </div>
    </div>
  );
};

export const BetaRegisterPage: React.FC = () => {
  const { registerWithEmail, signInWithGoogle } = useBetaAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('A confirmação de senha não confere.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      await registerWithEmail(fullName, email, password);
      navigate('/beta/onboarding');
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigate('/beta/onboarding');
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Início</span>
          </Link>
          <BetaBadge />
        </div>

        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Criar conta na Versão Beta</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Etapa 1 — Cadastro de usuário com ambiente isolado por empresa.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-[#EF6464]/40 bg-[#EF6464]/10 p-3 text-xs text-[#EF6464]">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[#20C5D5]/50 transition-colors cursor-pointer"
        >
          <span>Cadastrar com Google</span>
        </button>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[var(--border-subtle)]" />
          <span className="shrink mx-3 text-[11px] text-[var(--text-secondary)]">ou preencha seus dados</span>
          <div className="flex-grow border-t border-[var(--border-subtle)]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nome completo</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex.: Maria Oliveira"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#20C5D5]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com.br"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#20C5D5]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#20C5D5]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Confirmação de senha</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#20C5D5]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#20C5D5] py-2.5 text-sm font-semibold text-[#06132D] hover:bg-[#38d3e2] transition-colors cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'Criando conta...' : 'Continuar para Dados da Empresa'}
          </button>
        </form>

        <div className="text-center text-xs text-[var(--text-secondary)] pt-3 border-t border-[var(--border-subtle)]">
          Já possui conta?{' '}
          <Link to="/beta/login" className="font-semibold text-[#20C5D5] hover:underline">
            Fazer login
          </Link>
        </div>
      </div>
    </div>
  );
};

export const BetaResetPasswordPage: React.FC = () => {
  const { resetPassword } = useBetaAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <Link to="/beta/login" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Voltar ao login</span>
          </Link>
          <BetaBadge />
        </div>
        <h1 className="text-xl font-bold">Recuperar senha</h1>
        {sent ? (
          <div className="rounded-lg border border-[#20B981]/40 bg-[#20B981]/10 p-4 text-xs text-[#20B981] space-y-2">
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              E-mail de redefinição enviado
            </div>
            <p className="text-[var(--text-secondary)]">Verifique sua caixa de entrada e spam para criar uma nova senha.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-[#EF6464]/40 bg-[#EF6464]/10 p-3 text-xs text-[#EF6464]">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">E-mail cadastrado</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#20C5D5] py-2.5 text-sm font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer"
            >
              {submitting ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const BetaOnboardingPage: React.FC = () => {
  const { firebaseUser, apiFetch, refreshProfile } = useBetaAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<'empresa' | 'integracoes' | 'plano' | 'resumo' | 'confirmacao'>('empresa');
  const [cnpjQuery, setCnpjQuery] = useState('');
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjNotice, setCnpjNotice] = useState('');
  const [cnpjNeedsConfirm, setCnpjNeedsConfirm] = useState(false);
  const [cnpjReviewed, setCnpjReviewed] = useState(false);
  const [logoFile, setLogoFile] = useState<{
    fileName: string;
    mimeType: string;
    dataBase64: string;
  } | null>(null);

  const [form, setForm] = useState({
    name: '',
    legalName: '',
    tradeName: '',
    cnpj: '',
    cnae: '',
    segment: '',
    companySize: '',
    registrationStatus: '',
    description: '',
    operationType: 'both',
    address: '',
    city: '',
    state: '',
    phone: '',
    commercialEmail: firebaseUser?.email || '',
    website: '',
    logoUrl: '',
  });

  const [planCode, setPlanCode] = useState<PlanCode>('profissional');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [protocolCode, setProtocolCode] = useState('');

  const handleLookupCnpj = async () => {
    if (!cnpjQuery.trim()) return;
    setCnpjLoading(true);
    setCnpjNotice('');
    setError('');
    try {
      const res = await fetch(`/api/public/cnpj/${cnpjQuery.replace(/\D/g, '')}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao consultar CNPJ');
      setForm((prev) => ({
        ...prev,
        cnpj: data.cnpj || prev.cnpj,
        legalName: data.legalName || prev.legalName,
        tradeName: data.tradeName || prev.tradeName,
        name: data.tradeName || data.legalName || prev.name,
        cnae: data.cnae || prev.cnae,
        segment: data.segment || prev.segment,
        companySize: data.companySize || prev.companySize,
        registrationStatus: data.registrationStatus || prev.registrationStatus,
        city: data.city || prev.city,
        state: data.state || prev.state,
        address: data.address || prev.address,
        phone: data.phone || prev.phone,
        commercialEmail: data.commercialEmail || prev.commercialEmail,
      }));
      setCnpjNotice(`Dados preenchidos via ${data.provider}. Revise os campos editáveis e confirme antes de avançar.`);
      setCnpjNeedsConfirm(true);
      setCnpjReviewed(false);
    } catch (err) {
      setCnpjNotice(
        err instanceof Error
          ? err.message
          : 'Consulta pública indisponível. Continue preenchendo manualmente.'
      );
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const dataBase64 = reader.result;
        setLogoFile({
          fileName: file.name,
          mimeType: file.type || 'image/png',
          dataBase64,
        });
        setForm((prev) => ({ ...prev, logoUrl: dataBase64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCompany = async () => {
    if (!form.name.trim()) {
      setError('Informe o nome da empresa para concluir.');
      setStep('empresa');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await apiFetch<{ company: { id: number } }>('/api/beta/companies', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          logoUrl: '',
          planCode,
          billingCycle,
        }),
      });
      if (logoFile && created?.company?.id) {
        const asset = await apiFetch<{ url: string }>(
          `/api/beta/companies/${created.company.id}/assets`,
          {
            method: 'POST',
            body: JSON.stringify(logoFile),
          }
        );
        if (asset?.url) {
          await apiFetch(`/api/beta/companies/${created.company.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ logoUrl: asset.url }),
          });
        }
      }
      await refreshProfile();
      setProtocolCode(`GD-${Math.floor(100000 + Math.random() * 899999)}`);
      setStep('confirmacao');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar empresa.');
    } finally {
      setSaving(false);
    }
  };

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex items-center justify-center p-6">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center space-y-3 max-w-md">
          <BetaBadge />
          <p className="text-sm text-[var(--text-secondary)]">
            Faça login ou cadastre-se para configurar sua empresa.
          </p>
          <Link
            to="/beta/cadastro"
            className="inline-block rounded-lg bg-[#20C5D5] px-5 py-2.5 text-xs font-semibold text-[#06132D]"
          >
            Ir para Cadastro
          </Link>
        </div>
      </div>
    );
  }

  const stepsMeta = [
    { id: 'empresa', num: '1', label: 'Empresa' },
    { id: 'integracoes', num: '2', label: 'Integrações' },
    { id: 'plano', num: '3', label: 'Seleção' },
    { id: 'resumo', num: '4', label: 'Resumo & Dados' },
    { id: 'confirmacao', num: '5', label: 'Confirmação' },
  ] as const;

  const activeIdx = stepsMeta.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)]">
      {/* Top onboarding header matching PDF 2 pages 17-19 */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/src/assets/images/gemeo_digital_icon_1794938598899.jpg"
              alt="Gêmeo Digital"
              className="h-8 w-8 rounded-lg object-cover border border-[#20C5D5]/30"
            />
            <span className="text-sm font-extrabold text-white">GÊMEO DIGITAL</span>
          </div>
          <BetaBadge />
        </div>
      </header>

      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        {/* Stepper bar inspired by PDF 2 p.17-19 */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs">
          {stepsMeta.map((s, idx) => {
            const done = idx < activeIdx;
            const current = idx === activeIdx;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={step === 'confirmacao'}
                  onClick={() => setStep(s.id)}
                  className={`inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-default ${
                    current
                      ? 'text-[var(--text-primary)] font-semibold'
                      : done
                      ? 'text-[#20B981]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                      done
                        ? 'bg-[#20B981]/20 border-[#20B981] text-[#20B981]'
                        : current
                        ? 'bg-[#20C5D5] border-[#20C5D5] text-[#06132D]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {done ? '✓' : s.num}
                  </span>
                  <span>{s.label}</span>
                </button>
                {idx < stepsMeta.length - 1 && (
                  <span className="hidden sm:inline-block w-6 h-px bg-[var(--border-subtle)]" />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg border border-[#EF6464]/40 bg-[#EF6464]/10 p-3 text-xs text-[#EF6464]">
            {error}
          </div>
        )}

        {/* STEP 1: EMPRESA */}
        {step === 'empresa' && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5">
            <div>
              <h1 className="text-lg font-bold">Dados da Empresa</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                O ambiente privado será criado isoladamente no PostgreSQL para estes dados.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold">Consulta automática de CNPJ (opcional)</span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  BrasilAPI / ReceitaWS · MEI ou sem CNPJ pode preencher manualmente
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={cnpjQuery}
                  onChange={(e) => setCnpjQuery(e.target.value)}
                  placeholder="Digite os 14 dígitos do CNPJ (opcional)"
                  className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm font-mono text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  disabled={cnpjLoading}
                  onClick={handleLookupCnpj}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer"
                >
                  {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span>Consultar CNPJ</span>
                </button>
              </div>
              {cnpjNotice && <div className="text-xs text-[#20C5D5]">{cnpjNotice}</div>}
              {cnpjNeedsConfirm && (
                <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cnpjReviewed}
                    onChange={(e) => setCnpjReviewed(e.target.checked)}
                  />
                  Confirmo que revisei os dados retornados da consulta pública acima.
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Nome da empresa *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: João Store"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Segmento de atuação</label>
                <input
                  type="text"
                  value={form.segment}
                  onChange={(e) => setForm({ ...form, segment: e.target.value })}
                  placeholder="Ex.: Varejo, Alimentação, Serviços..."
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Razão social</label>
                <input
                  type="text"
                  value={form.legalName}
                  onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Nome fantasia</label>
                <input
                  type="text"
                  value={form.tradeName}
                  onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Tipo de operação</label>
                <select
                  value={form.operationType}
                  onChange={(e) => setForm({ ...form, operationType: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="physical">Somente física</option>
                  <option value="ecommerce">Somente e-commerce</option>
                  <option value="both">Ambos (física e e-commerce)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1">Porte</label>
                  <input
                    type="text"
                    placeholder="MEI/ME/EPP"
                    value={form.companySize}
                    onChange={(e) => setForm({ ...form, companySize: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1">CNAE</label>
                  <input
                    type="text"
                    placeholder="CNAE"
                    value={form.cnae}
                    onChange={(e) => setForm({ ...form, cnae: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Endereço</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[var(--text-secondary)] mb-1">Cidade</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1">UF</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Telefone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">E-mail comercial</label>
                <input
                  type="email"
                  value={form.commercialEmail}
                  onChange={(e) => setForm({ ...form, commercialEmail: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[var(--text-secondary)] mb-1">Descrição da empresa</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[var(--text-secondary)] mb-1">Logotipo da empresa (opcional)</label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-3 py-2 text-xs font-medium cursor-pointer hover:border-[#20C5D5]">
                    <Upload className="h-4 w-4 text-[#20C5D5]" />
                    <span>Selecionar imagem</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoFile} className="hidden" />
                  </label>
                  {form.logoUrl && (
                    <img src={form.logoUrl} alt="Prévia logotipo" className="h-10 w-10 rounded-lg object-cover border border-[var(--border-subtle)]" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!form.name.trim()) {
                    setError('Informe pelo menos o nome da empresa para prosseguir.');
                    return;
                  }
                  if (cnpjNeedsConfirm && !cnpjReviewed) {
                    setError('Marque a caixa confirmando que você revisou os dados preenchidos pela consulta de CNPJ.');
                    return;
                  }
                  setError('');
                  setStep('integracoes');
                }}
                className="rounded-lg bg-[#20C5D5] px-5 py-2.5 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer"
              >
                Avançar para Integrações →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: INTEGRAÇÕES */}
        {step === 'integracoes' && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5">
            <h2 className="text-base font-bold">Site Próprio e Canais de Venda</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Conectores para iFood, Mercado Livre, OLX, Shopee, Amazon, Shopify e WhatsApp Business ficam disponíveis no painel de Dados da Empresa após o cadastro. Nenhuma conexão é simulada sem credenciais autorizadas.
            </p>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                Site ou loja virtual própria (opcional)
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://www.suaempresa.com.br"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep('empresa')}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-white cursor-pointer"
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep('plano')}
                className="rounded-lg bg-[#20C5D5] px-5 py-2.5 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer"
              >
                Escolher Plano →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SELEÇÃO DO PLANO */}
        {step === 'plano' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Planos e Assinaturas</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Escolha o nível de inteligência ambiental adequado ao momento da sua empresa.
                </p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1 rounded-md font-medium cursor-pointer ${
                    billingCycle === 'monthly' ? 'bg-[#20C5D5] text-[#06132D]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3 py-1 rounded-md font-medium cursor-pointer ${
                    billingCycle === 'annual' ? 'bg-[#20C5D5] text-[#06132D]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Anual ({ANNUAL_DISCOUNT_LABEL})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.values(PLANS_CONFIG).map((plan) => {
                const selected = planCode === plan.code;
                const price = billingCycle === 'annual' ? plan.annualMonthlyEquivalent : plan.monthlyPrice;
                return (
                  <button
                    key={plan.code}
                    type="button"
                    onClick={() => setPlanCode(plan.code)}
                    className={`text-left rounded-xl border p-5 bg-[var(--bg-card)] space-y-2.5 cursor-pointer transition-all ${
                      selected
                        ? 'border-[#20C5D5] ring-2 ring-[#20C5D5]/30'
                        : 'border-[var(--border-subtle)] hover:border-[#20C5D5]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                        {plan.name}
                      </span>
                      {plan.recommended && (
                        <span className="text-[11px] font-semibold text-[#20C5D5]">★ Recomendado</span>
                      )}
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums">
                      R$ {price.toFixed(2).replace('.', ',')}
                      <span className="text-xs font-sans font-normal text-[var(--text-secondary)]">/mês</span>
                    </div>
                    <div className="text-xs text-[#20C5D5]">Teste gratuito de {plan.trialDays} dias</div>
                    <ul className="space-y-1.5 text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border-subtle)]">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <Check className="h-3.5 w-3.5 text-[#20C5D5] shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep('integracoes')}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)] cursor-pointer"
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep('resumo')}
                className="rounded-lg bg-[#20C5D5] px-5 py-2.5 text-xs font-semibold text-[#06132D] cursor-pointer"
              >
                Continuar para Resumo →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: RESUMO & DADOS (PDF 2 p.17-18) */}
        {step === 'resumo' && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">
                  PLANO SELECIONADO
                </div>
                <h2 className="text-2xl font-bold mt-1">{PLANS_CONFIG[planCode].name}</h2>
                <p className="text-xs text-[var(--text-secondary)]">{PLANS_CONFIG[planCode].tagline}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono tabular-nums">
                  R$ {(billingCycle === 'annual' ? PLANS_CONFIG[planCode].annualMonthlyEquivalent : PLANS_CONFIG[planCode].monthlyPrice).toFixed(2).replace('.', ',')}
                  <span className="text-xs font-sans font-normal text-[var(--text-secondary)]">/mês</span>
                </div>
                <div className="text-[11px] text-[#20C5D5]">
                  {PLANS_CONFIG[planCode].trialDays} dias gratuitos · Ciclo {billingCycle === 'annual' ? 'Anual' : 'Mensal'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-4 text-xs">
              <div>
                <div className="text-[var(--text-secondary)]">Responsável</div>
                <div className="font-semibold mt-0.5">{firebaseUser.displayName || firebaseUser.email}</div>
                <div className="text-[var(--text-secondary)] mt-2">Empresa</div>
                <div className="font-semibold mt-0.5">{form.name}</div>
              </div>
              <div>
                <div className="text-[var(--text-secondary)]">E-mail</div>
                <div className="font-semibold mt-0.5">{firebaseUser.email}</div>
                <div className="text-[var(--text-secondary)] mt-2">Segmento</div>
                <div className="font-semibold mt-0.5">{form.segment || 'A definir'}</div>
              </div>
            </div>

            <div className="rounded-lg border border-[#F2B84B]/30 bg-[#F2B84B]/10 p-3 text-xs text-[#F2B84B] flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{PAYMENT_NOTICE_DEMO}</span>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('plano')}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-white cursor-pointer"
              >
                ← Trocar de plano
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleCreateCompany}
                className="rounded-lg bg-[#F4F8FF] px-6 py-2.5 text-xs font-semibold text-[#06132D] hover:bg-white cursor-pointer disabled:opacity-60"
              >
                {saving ? 'Provisionando ambiente...' : 'Confirmar contratação e criar empresa'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: CONFIRMAÇÃO (PDF 2 p.19) */}
        {step === 'confirmacao' && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center space-y-5 max-w-2xl mx-auto">
            <div className="h-12 w-12 rounded-full border border-[#20B981]/40 bg-[#20B981]/15 text-[#20B981] flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Contratação confirmada</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Plano {PLANS_CONFIG[planCode].name} · Protocolo {protocolCode} · Empresa {form.name} criada no PostgreSQL
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/beta/app/painel')}
              className="rounded-lg bg-[#20C5D5] px-6 py-2.5 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer"
            >
              Acessar a plataforma
            </button>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3 text-[11px] text-[var(--text-secondary)]">
              {PAYMENT_NOTICE_DEMO}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
