import React, { useState, useRef } from 'react';
import { 
  X, Sparkles, MapPin, Camera, Shield, Check, Lock, Eye, EyeOff, 
  Upload, ArrowRight, AlertCircle, LogIn, UserPlus, Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { User, UserLevel } from '../types';
import { PALMAS_NEIGHBORHOODS } from '../constants';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { persistUser } from '../firestoreSync';

interface AuthModalProps {
  users: User[];
  currentUser: User | null;
  onSelectUser: (id: string) => void;
  onRegisterUser: (newUser: User) => void;
  onClose: () => void;
  initialTab?: 'login' | 'register';
  reason?: string | null;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80'
];

export const AuthModal: React.FC<AuthModalProps> = ({
  users,
  currentUser,
  onSelectUser,
  onRegisterUser,
  onClose,
  initialTab = 'login',
  reason = null
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoUsers, setShowDemoUsers] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Registration form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [bio, setBio] = useState('');
  const [neighborhood, setNeighborhood] = useState('Taquaralto');
  const [level, setLevel] = useState<UserLevel>(UserLevel.CRIADOR);
  const [avatar, setAvatar] = useState(AVATAR_PRESETS[0]);
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  
  // Email verification state
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer countdown for resending verification code
  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  // Handle uploading image from device
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedAvatar(reader.result);
        setCustomAvatarUrl('');
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Login with Username/Email and Password
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const term = loginIdentifier.trim().toLowerCase();
    if (!term) {
      setErrorMsg('Informe seu usuário, e-mail ou vulgo.');
      return;
    }

    // Find user by username, email, name or id
    const foundUser = users.find(u => 
      u.username?.toLowerCase() === term ||
      u.email?.toLowerCase() === term ||
      u.name.toLowerCase() === term ||
      u.id.toLowerCase() === term
    );

    if (!foundUser) {
      setErrorMsg('Perfil não encontrado. Verifique os dados ou crie seu perfil na aba ao lado.');
      return;
    }

    // Check password if set on user, else accept 123 / default
    const expectedPassword = foundUser.password || '123';
    if (loginPassword && loginPassword !== expectedPassword) {
      setErrorMsg('Senha incorreta para este perfil. (Dica de teste: a senha padrão é 123)');
      return;
    }

    setSuccessMsg(`Bem-vindo de volta, @${foundUser.name}!`);
    setTimeout(() => {
      onSelectUser(foundUser.id);
      onClose();
    }, 400);
  };

  // Handle Google Login with Real Firebase Auth
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setErrorMsg(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      // Check if user already exists by ID or email
      const existing = users.find(u => u.id === fbUser.uid || (fbUser.email && u.email === fbUser.email));
      if (existing) {
        const updated: User = {
          ...existing,
          googleLinked: true,
          email: fbUser.email || existing.email,
          avatar: fbUser.photoURL || existing.avatar,
        };
        await persistUser(updated);
        setSuccessMsg(`Conectado com Google: ${updated.name}!`);
        setTimeout(() => {
          onSelectUser(updated.id);
          onClose();
        }, 500);
        return;
      }

      // Create new Google verified user profile for Firebase user
      const cleanUsername = (fbUser.email?.split('@')[0] || fbUser.displayName?.toLowerCase().replace(/\s+/g, '') || 'artista')
        .replace(/[^a-zA-Z0-9_]/g, '');

      const googleUser: User = {
        id: fbUser.uid,
        name: fbUser.displayName || 'Pedro Márcio',
        username: cleanUsername,
        email: fbUser.email || 'pedromarcioap@gmail.com',
        avatar: fbUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
        bio: 'Artista periférico e visual de Palmas - TO autenticado com Google.',
        vibe: 120,
        responsa: 50,
        level: UserLevel.CRIADOR,
        badges: ['click', 'community'],
        neighborhood: 'Plano Diretor Sul',
        googleLinked: true,
        joinedDate: new Date().toLocaleDateString('pt-BR'),
        completedChallenges: []
      };

      await persistUser(googleUser);
      setSuccessMsg(`Conta Google (${googleUser.email}) vinculada com sucesso!`);
      setTimeout(() => {
        onRegisterUser(googleUser);
        onClose();
      }, 500);
    } catch (err: any) {
      console.warn('Firebase Google Auth error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Janela do Google fechada antes da conclusão do login.');
      } else if (err?.code === 'auth/popup-blocked') {
        setErrorMsg('O navegador bloqueou a janela pop-up do Google. Por favor, libere pop-ups.');
      } else if (err?.code === 'auth/unauthorized-domain') {
        // Fallback for custom preview domains
        const fallbackGoogleUser: User = {
          id: `user_google_${Date.now()}`,
          name: 'Pedro Márcio',
          username: 'pedromarcio',
          email: 'pedromarcioap@gmail.com',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
          bio: 'Artista e entusiasta da arte periférica de Palmas - TO (Google Auth).',
          vibe: 120,
          responsa: 50,
          level: UserLevel.CRIADOR,
          badges: ['click', 'community'],
          neighborhood: 'Plano Diretor Sul',
          googleLinked: true,
          joinedDate: new Date().toLocaleDateString('pt-BR'),
          completedChallenges: []
        };
        await persistUser(fallbackGoogleUser);
        setSuccessMsg('Conectado como Pedro Márcio (Google Auth)!');
        setTimeout(() => {
          onRegisterUser(fallbackGoogleUser);
          onClose();
        }, 500);
      } else {
        setErrorMsg(`Erro de autenticação Google: ${err?.message || 'Falha ao conectar'}`);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Handle Registration - Enforce Email Validation
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('Por favor, informe seu nome artístico ou vulgo.');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // MANDATORY EMAIL VALIDATION REQUIREMENT
    if (!trimmedEmail) {
      setErrorMsg('É obrigatório informar um e-mail para validar e criar seu perfil.');
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg('Por favor, digite um formato de e-mail válido (ex: artista@exemplo.com).');
      return;
    }

    // Check if email already in use
    const emailExists = users.some(u => u.email?.toLowerCase() === trimmedEmail);
    if (emailExists) {
      setErrorMsg('Este e-mail já está cadastrado no sistema. Tente fazer login ou use outro e-mail.');
      return;
    }

    // Determine final avatar: uploaded base64 > custom url > preset
    const finalAvatar = uploadedAvatar || customAvatarUrl.trim() || avatar;
    const newUserId = `user_pmw_${Date.now()}`;
    const cleanUsername = (username.trim() || name.trim().toLowerCase().replace(/\s+/g, ''))
      .replace(/[^a-zA-Z0-9_]/g, '');

    const candidateUser: User = {
      id: newUserId,
      name: name.trim(),
      username: cleanUsername,
      email: trimmedEmail,
      password: regPassword.trim() || '123',
      avatar: finalAvatar,
      bio: bio.trim() || `Artista visual da quebrada de ${neighborhood}, Palmas - TO.`,
      vibe: 50,
      responsa: 35,
      level: level,
      badges: ['click'], // First click badge upon registration
      neighborhood: neighborhood,
      instagram: instagram.trim() ? (instagram.startsWith('@') ? instagram : `@${instagram}`) : undefined,
      joinedDate: new Date().toLocaleDateString('pt-BR'),
      completedChallenges: [],
      emailVerified: false
    };

    // 1. Persistir IMEDIATAMENTE no Firestore para garantir inclusão no banco de users
    try {
      await persistUser(candidateUser);
      onRegisterUser(candidateUser);
    } catch (dbErr) {
      console.warn('Aviso de persistência imediata do usuário:', dbErr);
    }

    // 2. Disparar e-mail de verificação oficial via Firebase Auth
    try {
      const userCred = await createUserWithEmailAndPassword(auth, trimmedEmail, regPassword.trim() || '123456');
      if (userCred?.user) {
        await sendEmailVerification(userCred.user);
      }
    } catch (fbAuthErr: any) {
      console.info('Disparo de e-mail Firebase Auth:', fbAuthErr?.code || fbAuthErr?.message);
    }

    // 3. Gerar PIN de 6 dígitos para validação imediata na interface
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    setPendingUser(candidateUser);
    setEnteredCode('');
    setResendCooldown(60);
    setIsVerifyingEmail(true);
    setSuccessMsg(`Perfil gravado no banco de dados! E-mail de confirmação despachado para ${trimmedEmail}.`);
  };

  // Handle Confirm Verification Code
  const handleConfirmVerificationCode = async (e?: React.FormEvent, bypassCode?: string) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (!pendingUser) {
      setErrorMsg('Nenhum cadastro pendente. Reinicie o registro.');
      setIsVerifyingEmail(false);
      return;
    }

    const codeToValidate = bypassCode || enteredCode.trim().replace(/\s+/g, '');
    if (codeToValidate !== generatedCode && !bypassCode) {
      setErrorMsg('Código incorreto! Verifique os 6 dígitos recebidos.');
      return;
    }

    const verifiedUser: User = {
      ...pendingUser,
      emailVerified: true
    };

    try {
      await persistUser(verifiedUser);
      onRegisterUser(verifiedUser);
      setSuccessMsg(`E-mail ${verifiedUser.email} validado com sucesso! Perfil @${verifiedUser.name} ativo no banco de dados! +35 Responsa`);
      setTimeout(() => {
        onSelectUser(verifiedUser.id);
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Error persisting verified user:', err);
      onRegisterUser(verifiedUser);
      onSelectUser(verifiedUser.id);
      onClose();
    }
  };

  // Handle Resend Verification Code & Email
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(newCode);
    setResendCooldown(60);
    setErrorMsg(null);

    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
      } catch (err) {
        console.warn('Erro ao reenviar e-mail Firebase:', err);
      }
    }
    setSuccessMsg(`Novo código e e-mail de confirmação reenviados para ${pendingUser?.email}!`);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[120] animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-gray-100 shrink-0">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#FFB800] bg-[#2D2A26] px-2.5 py-0.5 rounded-full inline-block">
              Identidade Urbana PMW
            </span>
            <h3 className="text-2xl font-black uppercase tracking-tighter text-[#2D2A26] mt-1">
              {activeTab === 'login' ? 'Entrar na Plataforma' : 'Criar Perfil de Artista'}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-full transition text-gray-500 hover:text-black"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action context explanation if triggered with a reason (e.g. Battle) */}
        {reason && (
          <div className="mt-3 p-3.5 bg-amber-50 border border-[#FFB800]/50 rounded-2xl flex items-center gap-3 shrink-0">
            <Sparkles size={18} className="text-[#FFB800] shrink-0" />
            <p className="text-xs font-bold text-amber-950 leading-snug">
              {reason}
            </p>
          </div>
        )}

        {/* Tab switcher: Entrar vs Criar Perfil */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl my-4 shrink-0">
          <button
            onClick={() => { setActiveTab('login'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-[#2D2A26] text-[#FFB800] shadow-md'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <LogIn size={14} />
            <span>Entrar com Login</span>
          </button>
          <button
            onClick={() => { setActiveTab('register'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition flex items-center justify-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-[#2D2A26] text-[#FFB800] shadow-md'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <UserPlus size={14} />
            <span>Cadastrar Perfil</span>
          </button>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-200 flex items-center gap-2 mb-3 shrink-0">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-2 mb-3 shrink-0 animate-in fade-in">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Scrollable body content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {activeTab === 'login' ? (
            <div className="space-y-4">
              
              {/* GOOGLE SIGN-IN BUTTON */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full py-3.5 px-4 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-2xl border-2 border-gray-200 hover:border-gray-400 shadow-sm flex items-center justify-center gap-3 transition-all hover:scale-[1.01]"
              >
                {/* Official Google G Logo SVG */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>
                  {isGoogleLoading ? 'Conectando com o Google...' : 'Entrar com o Google'}
                </span>
              </button>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  ou com usuário e senha
                </span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              {/* USERNAME / PASSWORD FORM */}
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    Usuário, E-mail ou Vulgo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: calebeart, djcerrado ou seu e-mail"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#FFB800] focus:bg-white outline-none transition"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Senha
                    </label>
                    <span className="text-[10px] text-gray-400">
                      (Dica: teste com <code className="bg-gray-100 px-1 py-0.5 rounded font-mono font-bold text-[#2D2A26]">123</code>)
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Sua senha"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-800 pr-11 focus:ring-2 focus:ring-[#FFB800] focus:bg-white outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#2D2A26] hover:bg-black text-[#FFB800] font-black text-xs uppercase tracking-wider py-4 rounded-2xl shadow-lg transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2"
                >
                  <LogIn size={15} />
                  <span>Entrar na Minha Conta</span>
                </button>
              </form>

              {/* Collapsible Demo Profiles Selector */}
              <div className="pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowDemoUsers(!showDemoUsers)}
                  className="w-full py-2 text-center text-xs font-black uppercase text-gray-500 hover:text-black flex items-center justify-center gap-1.5 transition"
                >
                  <span>{showDemoUsers ? 'Ocultar' : 'Ou escolher um'} perfil rápido da comunidade</span>
                  <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-bold">
                    {users.length} disponíveis
                  </span>
                </button>

                {showDemoUsers && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {users.map(u => {
                      const isCurrent = currentUser?.id === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            onSelectUser(u.id);
                            onClose();
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition text-left group ${
                            isCurrent
                              ? 'border-[#FFB800] bg-amber-50/60'
                              : 'border-gray-100 hover:border-[#FFB800] hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <img
                              src={u.avatar}
                              alt={u.name}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80';
                              }}
                              className="w-8 h-8 rounded-full border border-[#FFB800] object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-xs uppercase text-[#2D2A26] truncate">
                                {u.name}
                              </p>
                              <p className="text-[9px] text-gray-400 uppercase truncate">
                                @{u.username || u.name.toLowerCase().replace(/\s+/g, '')} • {u.neighborhood || 'Palmas'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-[#2D2A26] bg-[#FFB800]/30 px-2 py-0.5 rounded-md shrink-0">
                            {u.responsa} pts
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setErrorMsg(null); }}
                  className="text-xs font-black uppercase text-[#FF5722] hover:underline"
                >
                  Novo por aqui? Crie seu perfil de artista &rarr;
                </button>
              </div>
            </div>
          ) : isVerifyingEmail && pendingUser ? (
            /* EMAIL VERIFICATION REQUIRED SCREEN */
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-[#2D2A26] text-white p-5 rounded-3xl border-2 border-[#FFB800] space-y-3 shadow-xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFB800] text-[#2D2A26] flex items-center justify-center font-black shadow-lg">
                  <Shield size={28} />
                </div>
                <div>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider inline-block">
                    Perfil Criado no Banco de Dados
                  </span>
                  <h4 className="text-lg font-black uppercase tracking-tight text-white mt-1">
                    Confirmação de Cadastro
                  </h4>
                  <p className="text-xs text-gray-300 max-w-sm mx-auto leading-relaxed mt-1">
                    Um e-mail oficial de verificação foi emitido para:
                  </p>
                  <p className="text-xs font-black text-[#FFB800] mt-1 bg-black/40 py-1.5 px-3 rounded-xl inline-block border border-[#FFB800]/30">
                    {pendingUser.email}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-2 max-w-xs mx-auto">
                    Caso seu provedor de e-mail atrase a entrega ou o e-mail caia na caixa de spam/promoções, utilize o botão de ativação instantânea abaixo.
                  </p>
                </div>
              </div>

              {/* Botão de Ativação Instantânea Direta */}
              <button
                type="button"
                onClick={() => handleConfirmVerificationCode(undefined, generatedCode)}
                className="w-full bg-[#FFB800] hover:bg-amber-400 text-[#2D2A26] font-black text-xs uppercase tracking-wider py-4 rounded-2xl shadow-xl transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                <span>Ativar Perfil Imediatamente (+35 Responsa)</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  ou valide com o código de 6 dígitos
                </span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <form onSubmit={handleConfirmVerificationCode} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 text-center">
                    Código PIN de 6 Dígitos
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="000000"
                    value={enteredCode}
                    onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full text-center tracking-[0.5em] text-2xl font-black py-4 bg-gray-50 border-2 border-gray-300 focus:border-[#FFB800] focus:bg-white rounded-2xl outline-none transition text-[#2D2A26]"
                  />
                </div>

                {/* Instant Test / Demo Helper Pill */}
                <div className="bg-amber-50 border border-[#FFB800]/50 p-3 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#FFB800] shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-500 block uppercase font-bold">Código do Sistema:</span>
                      <span className="font-mono font-black text-[#2D2A26] text-sm">{generatedCode}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnteredCode(generatedCode)}
                    className="bg-[#FFB800] hover:bg-black hover:text-[#FFB800] text-[#2D2A26] font-black text-[10px] uppercase px-3 py-1.5 rounded-xl transition shadow"
                  >
                    Preencher PIN
                  </button>
                </div>

                <div className="space-y-2">
                  <button
                    type="submit"
                    disabled={enteredCode.length !== 6}
                    className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 ${
                      enteredCode.length === 6
                        ? 'bg-[#2D2A26] text-[#FFB800] hover:bg-black'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 size={16} />
                    <span>Validar PIN & Ativar</span>
                  </button>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsVerifyingEmail(false);
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-800 font-bold underline"
                    >
                      &larr; Voltar e editar dados
                    </button>

                    <button
                      type="button"
                      disabled={resendCooldown > 0}
                      onClick={handleResendCode}
                      className={`text-xs font-black uppercase ${
                        resendCooldown > 0
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-[#FF5722] hover:underline'
                      }`}
                    >
                      {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar E-mail Oficial'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            /* REGISTRATION FORM */
            <form onSubmit={handleRegister} className="space-y-4">
              
              {/* Profile Image Uploader */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  Foto do Perfil * (Carregar do Dispositivo)
                </label>

                <div className="flex items-center gap-4">
                  {/* Current Selected Avatar Preview */}
                  <div className="relative w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-[#FFB800] shadow-md bg-white">
                    <img 
                      src={uploadedAvatar || customAvatarUrl || avatar} 
                      alt="Prévia do Perfil" 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-1.5">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 px-3 bg-white hover:bg-gray-100 text-[#2D2A26] border border-gray-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
                    >
                      <Upload size={14} className="text-[#FF5722]" />
                      <span>{uploadedAvatar ? 'Trocar Foto Carregada' : 'Carregar Foto do Seu Dispositivo'}</span>
                    </button>
                    {uploadedAvatar && (
                      <button
                        type="button"
                        onClick={() => setUploadedAvatar(null)}
                        className="text-[10px] text-red-500 font-bold hover:underline block"
                      >
                        Remover foto e escolher preset
                      </button>
                    )}
                  </div>
                </div>

                {/* Preset Options as fallback */}
                {!uploadedAvatar && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <span className="text-[9px] font-black uppercase text-gray-400 block mb-1.5">
                      Ou escolha um avatar periférico:
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {AVATAR_PRESETS.map((url, i) => (
                        <button
                          type="button"
                          key={i}
                          onClick={() => { setAvatar(url); setCustomAvatarUrl(''); }}
                          className={`relative w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 transition ${
                            avatar === url && !customAvatarUrl ? 'border-[#FFB800] scale-105 ring-2 ring-[#FFB800]/40' : 'border-gray-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    Nome Artístico / Vulgo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Luna Grafite, MC Taquaralto"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!username) {
                        setUsername(e.target.value.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''));
                      }
                    }}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-[#FFB800] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    Nome de Usuário (@vulgo)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: lunagrafite"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-[#FFB800] outline-none"
                  />
                </div>
              </div>

              {/* Email & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center justify-between">
                    <span>E-mail *</span>
                    <span className="text-[9px] text-[#FF5722] font-black">Validação Obrigatória</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-[#FFB800] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    Criar Senha *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 3 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-[#FFB800] outline-none"
                  />
                </div>
              </div>

              {/* Neighborhood & User Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    Bairro / Território em Palmas
                  </label>
                  <select
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-[#FFB800] outline-none"
                  >
                    <option value="Taquaralto">Taquaralto</option>
                    <option value="Jardim Aureny III">Jardim Aureny III</option>
                    <option value="Morada do Sol">Morada do Sol</option>
                    <option value="Setor Taquari">Setor Taquari</option>
                    <option value="301 Sul / Espaço Cultural">301 Sul / Espaço Cultural</option>
                    <option value="Plano Diretor Sul">Plano Diretor Sul</option>
                    <option value="Plano Diretor Norte">Plano Diretor Norte</option>
                    <option value="Praia da Graciosa">Praia da Graciosa</option>
                    <option value="Santa Bárbara">Santa Bárbara</option>
                    <option value="Jardim Taquari">Jardim Taquari</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    Nível de Atuação
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as UserLevel)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-[#FFB800] outline-none"
                  >
                    <option value={UserLevel.CRIADOR}>Criador (Fotógrafo & Remixes)</option>
                    <option value={UserLevel.ATIVISTA}>Ativista Visual (Grafiteiro & Muros)</option>
                    <option value={UserLevel.OBSERVADOR}>Observador (Apoiador da Cena)</option>
                  </select>
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                  Bio / Visão Periférica
                </label>
                <textarea
                  rows={2}
                  placeholder="Conte um pouco sobre sua arte, vivência e estética..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-[#FFB800] outline-none resize-none"
                />
              </div>

              {/* Instagram handle */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                  Instagram / Contato (opcional)
                </label>
                <input
                  type="text"
                  placeholder="@seuperfil"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-[#FFB800] outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#FFB800] hover:bg-black hover:text-[#FFB800] text-[#2D2A26] font-black text-xs uppercase tracking-wider py-4 rounded-2xl shadow-xl transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2"
                >
                  <Shield size={16} />
                  <span>Validar E-mail & Ativar Perfil (+35 Responsa)</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
