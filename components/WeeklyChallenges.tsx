import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Trophy, 
  Calendar, 
  Clock, 
  Sparkles, 
  MapPin, 
  ShieldCheck, 
  Sword, 
  Flame, 
  CheckCircle2, 
  ArrowRight,
  PlusCircle,
  Share2,
  Tag,
  Edit3,
  Crown
} from 'lucide-react';
import { WeeklyChallenge, PhotoBase, User, Badge } from '../types';
import { BADGES } from '../constants';

interface WeeklyChallengesProps {
  challenges: WeeklyChallenge[];
  photos: PhotoBase[];
  currentUser: User | null;
  onRequireLogin: () => void;
  onOpenUploadForChallenge?: (challenge: WeeklyChallenge) => void;
  isAdmin?: boolean;
}

export const WeeklyChallenges: React.FC<WeeklyChallengesProps> = ({
  challenges,
  photos,
  currentUser,
  onRequireLogin,
  onOpenUploadForChallenge,
  isAdmin = false
}) => {
  const navigate = useNavigate();
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    challenges.find(c => c.status === 'active')?.id || challenges[0]?.id || ''
  );
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'upcoming' | 'completed'>('active');

  const selectedChallenge = challenges.find(c => c.id === selectedChallengeId) || challenges[0];

  // Entries for the selected challenge
  const challengeEntries = photos.filter(p => 
    p.challengeId === selectedChallenge?.id || 
    selectedChallenge?.tags.some(t => p.tags.includes(t)) ||
    (selectedChallenge?.featuredNeighborhood && p.location?.neighborhood?.toLowerCase().includes(selectedChallenge.featuredNeighborhood.toLowerCase()))
  );

  // Badge for reward
  const rewardBadge: Badge | undefined = BADGES.find(b => b.id === selectedChallenge?.rewardBadgeId);

  // Calculate days remaining
  const calculateDaysRemaining = (endDateStr: string) => {
    try {
      const end = new Date(endDateStr).getTime();
      const now = new Date().getTime();
      const diff = end - now;
      if (diff <= 0) return 'Encerrado';
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return `${days}d ${hours}h restantes`;
    } catch {
      return 'Em andamento';
    }
  };

  const filteredChallenges = challenges.filter(c => {
    if (filterStatus === 'all') return true;
    return c.status === filterStatus;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Admin Quick-Access CMS Banner */}
      {isAdmin && (
        <div className="bg-[#2D2A26] text-white p-4 rounded-3xl border-2 border-[#FFB800] shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFB800] text-[#2D2A26] flex items-center justify-center font-black shrink-0 shadow">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-[#FFB800]">Painel do Administrador (CMS)</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">Modo Admin Ativo</span>
              </div>
              <p className="text-[11px] text-gray-300">
                Você tem permissão para gerenciar temas, diretrizes, títulos, descrições, tags e pódio dos desafios semanais.
              </p>
            </div>
          </div>

          <Link
            to="/admin/challenges"
            className="bg-[#FFB800] hover:bg-white text-[#2D2A26] px-4 py-2 rounded-xl text-xs font-black uppercase transition shadow flex items-center gap-1.5 shrink-0 hover:scale-105"
          >
            <Edit3 size={13} />
            <span>Gerenciar Desafios (CMS)</span>
          </Link>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 bg-[#FFB800]/20 text-[#2D2A26] px-3.5 py-1 rounded-full border border-[#FFB800]/30 mb-2">
            <Flame size={13} className="text-[#FF5722]" />
            <span className="text-[10px] font-black uppercase tracking-widest">Temporada Visual PMW</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-[#2D2A26]">
            Desafios Semanais
          </h2>
          <p className="text-xs text-gray-500 max-w-xl font-medium">
            Toda semana a quebrada ganha um novo tema. Crie ou remixe obras, acumule Responsa e conquiste insígnias exclusivas no pódio de Palmas!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/battle"
            className="inline-flex items-center gap-1.5 bg-[#2D2A26] text-[#FFB800] hover:bg-black px-4 py-2.5 rounded-2xl text-xs font-black uppercase transition shadow"
          >
            <Sword size={14} />
            <span>Votar nos Duelos</span>
          </Link>
          <Link
            to="/ranking"
            className="inline-flex items-center gap-1.5 bg-[#FFB800] text-[#2D2A26] hover:scale-105 px-4 py-2.5 rounded-2xl text-xs font-black uppercase transition shadow font-black"
          >
            <Trophy size={14} />
            <span>Ver Ranking</span>
          </Link>
        </div>
      </header>

      {/* Challenge Status Pills */}
      <div className="flex items-center gap-2 border-b border-gray-100 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilterStatus('active')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition ${
            filterStatus === 'active'
              ? 'bg-[#2D2A26] text-[#FFB800] shadow-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          🔥 Ativos ({challenges.filter(c => c.status === 'active').length})
        </button>
        <button
          onClick={() => setFilterStatus('upcoming')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition ${
            filterStatus === 'upcoming'
              ? 'bg-[#2D2A26] text-[#FFB800] shadow-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          ⏳ Em Breve ({challenges.filter(c => c.status === 'upcoming').length})
        </button>
        <button
          onClick={() => setFilterStatus('completed')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition ${
            filterStatus === 'completed'
              ? 'bg-[#2D2A26] text-[#FFB800] shadow-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          ✅ Concluídos ({challenges.filter(c => c.status === 'completed').length})
        </button>
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition ${
            filterStatus === 'all'
              ? 'bg-[#2D2A26] text-[#FFB800] shadow-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Todos ({challenges.length})
        </button>
      </div>

      {/* Selected Challenge Spotlight Hero Card */}
      {selectedChallenge && (
        <div className="bg-[#2D2A26] text-white rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-[#2D2A26] via-[#2D2A26]/80 to-transparent z-10" />
          <img 
            src={selectedChallenge.bannerUrl} 
            alt={selectedChallenge.title} 
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=80';
            }}
            className="w-full h-72 md:h-80 object-cover opacity-40 scale-105"
          />

          <div className="relative z-20 p-6 md:p-10 -mt-44 md:-mt-48 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  selectedChallenge.status === 'active' 
                    ? 'bg-emerald-500 text-white' 
                    : selectedChallenge.status === 'upcoming' 
                    ? 'bg-amber-500 text-[#2D2A26]' 
                    : 'bg-gray-500 text-white'
                }`}>
                  {selectedChallenge.status === 'active' ? '● Em Andamento' : selectedChallenge.status === 'upcoming' ? '○ Em Breve' : '✓ Finalizado'}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full text-gray-300">
                  {selectedChallenge.subtitle}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-[#FFB800] text-[#2D2A26] px-3.5 py-1 rounded-full text-xs font-black uppercase shadow">
                <Clock size={12} />
                <span>{calculateDaysRemaining(selectedChallenge.endDate)}</span>
              </div>
            </div>

            <div>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white">
                {selectedChallenge.title}
              </h1>
              <p className="text-sm md:text-base text-[#FFB800] font-bold mt-1">
                {selectedChallenge.theme}
              </p>
              <p className="text-xs md:text-sm text-gray-300 max-w-2xl mt-3 leading-relaxed">
                {selectedChallenge.description}
              </p>
            </div>

            {/* Territory & Tags */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {selectedChallenge.featuredNeighborhood && (
                <div className="inline-flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-xl text-xs text-gray-200">
                  <MapPin size={13} className="text-[#FFB800]" />
                  <span className="font-bold">{selectedChallenge.featuredNeighborhood}</span>
                </div>
              )}
              {selectedChallenge.tags.map(t => (
                <span key={t} className="text-xs text-[#FFB800] bg-white/5 px-2.5 py-1 rounded-xl font-bold">
                  {t}
                </span>
              ))}
            </div>

            {/* Winner Spotlight Box if assigned */}
            {selectedChallenge.winnerPhotoId && (() => {
              const winner = photos.find(p => p.id === selectedChallenge.winnerPhotoId);
              if (!winner) return null;
              return (
                <div className="bg-amber-500/20 border border-[#FFB800] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFB800] text-[#2D2A26] flex items-center justify-center font-black shrink-0 shadow">
                      <Crown size={22} />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#FFB800]">
                        Obra Campeã Oficial da Edição
                      </span>
                      <h4 className="font-black text-sm uppercase text-white">
                        "{winner.title}" • @{winner.authorName}
                      </h4>
                      <p className="text-[10px] text-gray-300">
                        Eleita pela curadoria da comunidade com destaque máximo no pódio.
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/lineage/${winner.id}`}
                    className="bg-[#FFB800] hover:bg-white text-[#2D2A26] font-black text-xs uppercase px-4 py-2 rounded-xl transition shadow flex items-center gap-1 shrink-0 self-start sm:self-auto"
                  >
                    <span>Ver Obra</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              );
            })()}

            {/* Rewards Card Box */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-5 border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#FFB800] text-[#2D2A26] flex items-center justify-center font-black text-2xl shrink-0 shadow">
                  {rewardBadge ? rewardBadge.icon : '🏆'}
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#FFB800]">
                    Recompensas do Desafio
                  </span>
                  <h4 className="font-black text-sm uppercase text-white">
                    +{selectedChallenge.rewardResponsa} Responsa + Insígnia "{rewardBadge?.name || 'Desafiante'}"
                  </h4>
                  <p className="text-[10px] text-gray-300">
                    {rewardBadge?.description || 'Desbloqueie conquista lendária e suba no ranking da comunidade.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Link
                    to="/admin/challenges"
                    className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase px-4 py-3 rounded-2xl border border-white/20 transition flex items-center gap-1.5"
                  >
                    <Edit3 size={14} className="text-[#FFB800]" />
                    <span>Editar CMS</span>
                  </Link>
                )}

                {selectedChallenge.status === 'active' && (
                  <button
                    onClick={() => {
                      if (!currentUser) {
                        onRequireLogin();
                        return;
                      }
                      if (onOpenUploadForChallenge) {
                        onOpenUploadForChallenge(selectedChallenge);
                      } else {
                        navigate('/');
                      }
                    }}
                    className="bg-[#FFB800] hover:bg-white text-[#2D2A26] font-black text-xs uppercase px-6 py-3 rounded-2xl shadow-xl transition-all transform hover:scale-105 shrink-0 flex items-center justify-center gap-2"
                  >
                    <PlusCircle size={15} />
                    <span>Participar Agora</span>
                  </button>
                )}
              </div>
            </div>

            {/* Rules list */}
            <div className="pt-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                Diretrizes & Critérios:
              </span>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-gray-300">
                {selectedChallenge.rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start space-x-2 bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <CheckCircle2 size={14} className="text-[#FFB800] shrink-0 mt-0.5" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Challenge Selector Mini Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">
          Escolha um Desafio da Temporada:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredChallenges.map(c => {
            const isSelected = c.id === selectedChallenge?.id;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedChallengeId(c.id)}
                className={`p-5 rounded-[2rem] cursor-pointer transition-all border-2 text-left flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#2D2A26] text-white border-[#FFB800] shadow-xl scale-[1.02]'
                    : 'bg-white text-[#2D2A26] border-gray-100 hover:border-gray-300 shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      c.status === 'active' ? 'bg-emerald-500/20 text-emerald-600' : c.status === 'upcoming' ? 'bg-amber-500/20 text-amber-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c.status === 'active' ? 'Ativo' : c.status === 'upcoming' ? 'Em Breve' : 'Concluído'}
                    </span>
                    <span className="text-[10px] font-black text-[#FFB800]">
                      +{c.rewardResponsa} pts
                    </span>
                  </div>
                  <h4 className="font-black text-base uppercase tracking-tight line-clamp-1">
                    {c.title}
                  </h4>
                  <p className={`text-xs mt-1 line-clamp-2 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                    {c.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 mt-2 border-t border-current/10">
                  <span className="text-[10px] font-bold opacity-70">
                    {c.featuredNeighborhood || 'Palmas - TO'}
                  </span>
                  <span className="text-[10px] font-black uppercase flex items-center gap-1 text-[#FFB800]">
                    <span>Explorar</span>
                    <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Entries Gallery for Selected Challenge */}
      <section className="space-y-4 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tight text-[#2D2A26] flex items-center gap-2">
              <span>Obras na Disputa</span>
              <span className="text-xs bg-[#FFB800] text-[#2D2A26] font-black px-2.5 py-0.5 rounded-full">
                {challengeEntries.length} {challengeEntries.length === 1 ? 'obra' : 'obras'}
              </span>
            </h3>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
              Fotos e remixes concorrendo às recompensas do tema
            </p>
          </div>

          <Link
            to="/battle"
            className="inline-flex items-center gap-1.5 bg-[#2D2A26] text-[#FFB800] hover:bg-black px-4 py-2 rounded-xl text-xs font-black uppercase transition self-start sm:self-auto"
          >
            <Sword size={13} />
            <span>Colocar em Batalha</span>
          </Link>
        </div>

        {challengeEntries.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-12 text-center shadow-sm border border-gray-100 space-y-4">
            <div className="w-14 h-14 bg-amber-50 text-[#FFB800] rounded-full flex items-center justify-center mx-auto">
              <Trophy size={28} />
            </div>
            <h4 className="text-xl font-black uppercase">Nenhuma obra enviada ainda</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Seja o primeiro artista visual a registrar sua visão para o desafio "{selectedChallenge?.title}" e garanta seu lugar no topo!
            </p>
            {selectedChallenge?.status === 'active' && (
              <button
                onClick={() => {
                  if (!currentUser) {
                    onRequireLogin();
                    return;
                  }
                  if (onOpenUploadForChallenge) {
                    onOpenUploadForChallenge(selectedChallenge);
                  }
                }}
                className="bg-[#FFB800] text-[#2D2A26] font-black text-xs uppercase px-5 py-2.5 rounded-xl hover:scale-105 transition shadow"
              >
                Enviar Primeira Obra
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {challengeEntries.map((photo, idx) => {
              const wins = photo.battleWins || 0;
              const losses = photo.battleLosses || 0;
              const total = wins + losses;
              const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

              return (
                <div
                  key={photo.id}
                  className="bg-white rounded-[2rem] overflow-hidden shadow-md border border-gray-100 flex flex-col group hover:shadow-xl transition-all"
                >
                  <div 
                    onClick={() => navigate(`/lineage/${photo.id}`)}
                    className="aspect-square relative overflow-hidden cursor-pointer"
                  >
                    <img 
                      src={photo.imageUrl} 
                      alt={photo.title} 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 bg-[#2D2A26]/90 backdrop-blur-md text-[#FFB800] font-black text-[10px] px-2.5 py-1 rounded-full uppercase">
                      {photo.type === 'remix' ? '🎨 Remix' : '📸 Base'}
                    </div>
                    {idx === 0 && (
                      <div className="absolute top-3 right-3 bg-[#FFB800] text-[#2D2A26] font-black text-[10px] px-2.5 py-1 rounded-full uppercase shadow flex items-center gap-1">
                        <Trophy size={11} />
                        <span>Líder</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-tight truncate text-[#2D2A26]">
                        {photo.title}
                      </h4>
                      <p className="text-[10px] text-gray-500 font-bold uppercase truncate">
                        Por @{photo.authorName} • {photo.location?.neighborhood || 'Palmas'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {wins}V - {losses}D
                        </span>
                        {total > 0 && (
                          <span className="text-[10px] font-bold text-gray-400">
                            {winRate}% win
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-black text-[#FFB800] bg-[#2D2A26] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles size={10} />
                        <span>{photo.vibeCount}</span>
                      </span>
                    </div>

                    <div className="pt-1 flex gap-2">
                      <button
                        onClick={() => navigate(`/remix/${photo.id}`)}
                        className="flex-1 bg-gray-100 hover:bg-[#FFB800] text-[#2D2A26] py-1.5 rounded-xl text-[10px] font-black uppercase transition text-center"
                      >
                        Remixar
                      </button>
                      <button
                        onClick={() => navigate(`/lineage/${photo.id}`)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition"
                      >
                        Ver
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
