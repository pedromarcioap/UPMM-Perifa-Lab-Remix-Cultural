
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save,
  Trash2,
  Loader2,
  Type,
  Sparkles,
  Image as ImageIcon,
  Zap,
  Layers,
  Search,
  Target,
  Check,
  Move
} from 'lucide-react';
import { PhotoBase, User, Sticker } from '../types';
import { STICKERS, ANIMATED_STICKERS, COLORS, STREET_FONTS } from '../constants';
import { AssetDrawer } from './AssetDrawer';
import { AssetItem } from '../types/assets';
import { ASSET_CATALOG } from '../constants/assetsCatalog';

interface Layer {
  id: string;
  type: 'sticker' | 'animated-sticker' | 'text';
  content: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  fontFamily?: string;
  opacity?: number;
}

interface FilterSettings {
  brightness: number;
  contrast: number;
  saturate: number;
  sepia: number;
  grayscale: number;
  hueRotate: number;
  blur: number;
}

const Editor: React.FC<{ photos: PhotoBase[], onSave: (remix: PhotoBase) => void, user: User }> = ({ photos, onSave, user }) => {
  const { photoId } = useParams();
  const navigate = useNavigate();
  const basePhoto = photos.find(p => p.id === photoId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [filters, setFilters] = useState<FilterSettings>({
    brightness: 1,
    contrast: 1,
    saturate: 1,
    sepia: 0,
    grayscale: 0,
    hueRotate: 0,
    blur: 0
  });

  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'filters' | 'stickers' | 'animated' | 'text'>('filters');
  const [stickerFilter, setStickerFilter] = useState<'all' | 'tag' | 'spray' | 'cerrado' | 'urban' | 'shapes'>('all');
  const [animatedFilter, setAnimatedFilter] = useState<'all' | 'urban' | 'spray' | 'shapes' | 'cerrado'>('all');
  const [inputText, setInputText] = useState('');
  const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false);
  const [selectedFont, setSelectedFont] = useState(STREET_FONTS[1].family);
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);
  const [canvasToast, setCanvasToast] = useState<string | null>(null);
  
  const dragStartPos = useRef({ x: 0, y: 0 });
  const layerStartPos = useRef({ x: 0, y: 0 });
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    if (!basePhoto) {
        navigate('/');
    }
  }, [basePhoto, navigate]);

  if (!basePhoto) return null;

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    if (imageCache.current.has(src)) return Promise.resolve(imageCache.current.get(src)!);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      if (src.startsWith('data:') || src.startsWith('blob:')) {
        img.src = src;
      } else {
        try {
          const url = new URL(src);
          // Only add cache buster if not a known high-perf CDN that might block it
          if (!src.includes('media.giphy.com')) {
            url.searchParams.set('upmm_cache', Date.now().toString());
          }
          img.src = url.toString();
        } catch (e) {
          img.src = src;
        }
      }

      img.onload = () => {
        imageCache.current.set(src, img);
        resolve(img);
      };
      img.onerror = () => {
        // Fallback without crossOrigin if CORS was the issue
        if (img.crossOrigin) {
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            imageCache.current.set(src, fallbackImg);
            resolve(fallbackImg);
          };
          fallbackImg.onerror = (e) => {
            console.error(`Falha ao carregar mídia: ${src.substring(0, 50)}...`, e);
            reject(new Error(`Erro ao processar imagem.`));
          };
          fallbackImg.src = src;
          return;
        }
        reject(new Error(`Erro ao processar imagem.`));
      };
    });
  };

  const drawCanvas = async (hideSelection = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      await document.fonts.ready;
      const baseImg = await loadImage(basePhoto.imageUrl);
      
      if (canvas.width !== 1000) {
        canvas.width = 1000;
        canvas.height = 1000 * (baseImg.height / baseImg.width);
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background with filters
      ctx.save();
      const filterString = `
        brightness(${filters.brightness}) 
        contrast(${filters.contrast}) 
        saturate(${filters.saturate}) 
        sepia(${filters.sepia}) 
        grayscale(${filters.grayscale}) 
        hue-rotate(${filters.hueRotate}deg)
        blur(${filters.blur}px)
      `.trim();
      
      ctx.filter = filterString;
      ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Draw layers
      for (const layer of layers) {
        ctx.save();
        ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
        ctx.translate(layer.x, layer.y);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        
        if (layer.type === 'sticker' || layer.type === 'animated-sticker') {
          try {
            const stickerImg = await loadImage(layer.content);
            ctx.drawImage(stickerImg, -layer.size / 2, -layer.size / 2, layer.size, layer.size);
          } catch (e) {
            // Draw placeholder for missing assets
            ctx.fillStyle = 'rgba(255,184,0,0.2)';
            ctx.fillRect(-layer.size/2, -layer.size/2, layer.size, layer.size);
          }
        } else if (layer.type === 'text') {
          const fontFamily = layer.fontFamily || STREET_FONTS[1].family;
          ctx.font = `900 ${layer.size}px ${fontFamily}`;
          ctx.fillStyle = COLORS.primary;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(2, layer.size * 0.15);
          ctx.lineJoin = 'round';
          ctx.strokeText(layer.content, 0, 0);
          ctx.fillText(layer.content, 0, 0);
        }

        if (!hideSelection && selectedLayerId === layer.id) {
          ctx.strokeStyle = COLORS.primary;
          ctx.lineWidth = 4;
          ctx.setLineDash([10, 5]);
          ctx.strokeRect(-layer.size / 2 - 12, -layer.size / 2 - 12, layer.size + 24, layer.size + 24);
        }
        ctx.restore();
      }
    } catch (err) {
      console.error("Erro na renderização:", err);
    }
  };

  // Animation Loop for GIF support on canvas
  useEffect(() => {
    const loop = async () => {
      await drawCanvas();
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    
    // We only need the loop if there are animated stickers
    const hasAnimated = layers.some(l => l.type === 'animated-sticker');
    
    if (hasAnimated) {
      animationFrameRef.current = requestAnimationFrame(loop);
    } else {
      drawCanvas();
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [filters, layers, selectedLayerId]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const clickedLayer = [...layers].reverse().find(layer => {
      const dist = Math.sqrt(Math.pow(x - layer.x, 2) + Math.pow(y - layer.y, 2));
      return dist < layer.size / 1.5;
    });

    if (clickedLayer) {
      setSelectedLayerId(clickedLayer.id);
      setIsCanvasDragging(true);
      dragStartPos.current = { x, y };
      layerStartPos.current = { x: clickedLayer.x, y: clickedLayer.y };
      
      if (clickedLayer.type === 'text' && clickedLayer.fontFamily) {
        setSelectedFont(clickedLayer.fontFamily);
      }
    } else {
      setSelectedLayerId(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isCanvasDragging || !selectedLayerId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const dx = x - dragStartPos.current.x;
    const dy = y - dragStartPos.current.y;

    setLayers(prev => prev.map(l => 
      l.id === selectedLayerId ? { ...l, x: layerStartPos.current.x + dx, y: layerStartPos.current.y + dy } : l
    ));
  };

  const handleAddSticker = (url: string, isAnimated = false) => {
    const newLayer: Layer = {
      id: Math.random().toString(36).substr(2, 9),
      type: isAnimated ? 'animated-sticker' : 'sticker',
      content: url,
      x: 500,
      y: 500,
      size: 250,
      rotation: 0,
      opacity: 1
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
  };

  // Posicionar imediatamente no centro geométrico do canvas sobre a foto base
  const handleSelectAsset = (asset: AssetItem) => {
    const canvas = canvasRef.current;
    const centerX = canvas ? Math.round(canvas.width / 2) : 500;
    const centerY = canvas ? Math.round(canvas.height / 2) : 500;

    const newLayer: Layer = {
      id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: asset.type === 'animated_sticker' ? 'animated-sticker' : 'sticker',
      content: asset.url,
      x: centerX,
      y: centerY,
      size: 260,
      rotation: 0,
      opacity: 1
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
    setIsAssetDrawerOpen(false);

    setCanvasToast(`"${asset.name}" posicionado no centro do canvas!`);
    setTimeout(() => setCanvasToast(null), 2500);
  };

  // Handler de Soltar (Drop) diretamente sobre o canvas: insere o asset centralizado
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCanvas(false);

    try {
      const rawData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('upmm/asset');
      let asset: AssetItem | null = null;

      if (rawData) {
        asset = JSON.parse(rawData);
      } else {
        const assetId = e.dataTransfer.getData('text/plain');
        if (assetId) {
          asset = ASSET_CATALOG.find(a => a.id === assetId) || null;
        }
      }

      if (!asset) return;

      const canvas = canvasRef.current;
      const centerX = canvas ? Math.round(canvas.width / 2) : 500;
      const centerY = canvas ? Math.round(canvas.height / 2) : 500;

      const newLayer: Layer = {
        id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: asset.type === 'animated_sticker' ? 'animated-sticker' : 'sticker',
        content: asset.url,
        x: centerX,
        y: centerY,
        size: 260,
        rotation: 0,
        opacity: 1
      };

      setLayers(prev => [...prev, newLayer]);
      setSelectedLayerId(newLayer.id);
      setIsAssetDrawerOpen(false);

      setCanvasToast(`"${asset.name}" solto e centralizado no canvas!`);
      setTimeout(() => setCanvasToast(null), 2500);
    } catch (err) {
      console.warn("Erro ao processar asset solto no canvas:", err);
    }
  };

  const handleAddText = () => {
    if (!inputText.trim()) return;
    const newLayer: Layer = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'text',
      content: inputText.toUpperCase(),
      x: 500,
      y: 500,
      size: 110,
      rotation: 0,
      fontFamily: selectedFont,
      opacity: 1
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
    setInputText('');
  };

  const handleFontChange = (fontFamily: string) => {
    setSelectedFont(fontFamily);
    if (selectedLayerId) {
      setLayers(layers.map(l => l.id === selectedLayerId && l.type === 'text' ? { ...l, fontFamily } : l));
    }
  };

  const handleSave = async () => {
    setIsRendering(true);
    await drawCanvas(true); // Final render without selection UI
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      onSave({
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        authorName: user.name,
        title: `Remix de ${basePhoto.title}`,
        imageUrl: dataUrl,
        tags: [...basePhoto.tags, 'Remix'],
        vibeCount: 0,
        type: 'remix',
        originalPhotoId: basePhoto.id,
        location: basePhoto.location ? { ...basePhoto.location } : undefined
      });
      navigate(`/profile/${user.id}`);
    } catch (e) {
      console.error("Erro ao salvar remix:", e);
      alert("Houve um erro técnico ao gerar sua arte. Tente novamente.");
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-40px)] bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100">
      <header className="p-4 border-b border-gray-100 flex justify-between items-center bg-[#2D2A26] text-white">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition">
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-xs font-black uppercase tracking-widest text-[#FFB800]">Estúdio de Remix</h2>
          <p className="text-[8px] font-bold text-gray-400">@{basePhoto.authorName} • {basePhoto.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => setIsAssetDrawerOpen(true)}
            className="bg-white/10 hover:bg-[#FFB800] hover:text-[#2D2A26] text-white px-3.5 py-2 rounded-xl font-black uppercase text-xs flex items-center space-x-1.5 transition shadow-sm"
            title="Abrir Gaveta de Assets (Grafite, Bombing, Cultura de Rua, Rasgos e Loops)"
          >
            <Layers size={14} />
            <span className="hidden sm:inline">Gaveta de Assets</span>
            <span className="bg-[#FFB800] text-[#2D2A26] text-[9px] font-black px-1.5 py-0.2 rounded-md">
              {ASSET_CATALOG.length}
            </span>
          </button>
          <button 
            onClick={handleSave}
            className="bg-[#FFB800] text-[#2D2A26] px-4 py-2 rounded-xl font-black uppercase text-xs flex items-center space-x-2 hover:scale-105 transition shadow"
          >
            <Save size={14} />
            <span>Salvar Remix</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        <div 
          className={`flex-1 p-4 flex items-center justify-center relative overflow-hidden transition-colors ${
            isDragOverCanvas ? 'bg-amber-100/70' : 'bg-gray-100'
          }`}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={() => setIsCanvasDragging(false)}
          onMouseLeave={() => setIsCanvasDragging(false)}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (!isDragOverCanvas) setIsDragOverCanvas(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragOverCanvas(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragOverCanvas(false);
            }
          }}
          onDrop={handleCanvasDrop}
        >
          <div className="relative shadow-2xl max-w-full max-h-full bg-white rounded-lg">
            <canvas 
              ref={canvasRef} 
              onMouseDown={handleCanvasMouseDown}
              className={`max-w-full max-h-[45vh] lg:max-h-[70vh] cursor-crosshair rounded-lg transition-all ${
                isDragOverCanvas ? 'ring-4 ring-[#FFB800] ring-offset-4' : ''
              }`}
            />
            {/* Overlay visual quando o usuário arrasta um sticker/loop para soltar no canvas */}
            {isDragOverCanvas && (
              <div className="absolute inset-0 bg-[#2D2A26]/85 backdrop-blur-xs rounded-lg flex flex-col items-center justify-center text-white z-30 pointer-events-none p-6 text-center animate-in fade-in zoom-in-95 duration-150 border-4 border-dashed border-[#FFB800]">
                <div className="w-16 h-16 rounded-full bg-[#FFB800] text-[#2D2A26] flex items-center justify-center mb-3 shadow-xl animate-bounce">
                  <Target size={36} strokeWidth={2.5} />
                </div>
                <h4 className="text-base font-black uppercase tracking-wider text-[#FFB800]">
                  Solte para Centralizar
                </h4>
                <p className="text-xs font-bold text-gray-200 mt-1 max-w-xs">
                  O sticker será inserido automaticamente no centro geométrico do seu canvas de intervenção.
                </p>
              </div>
            )}

            {isRendering && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center rounded-lg z-20">
                <Loader2 className="text-[#FFB800] animate-spin mb-4" size={48} />
                <p className="text-white font-black uppercase tracking-widest text-xs">Revelando sua Visão...</p>
              </div>
            )}
          </div>

          {/* Feedback Toast flutuante de sucesso ao inserir/soltar asset */}
          {canvasToast && (
            <div className="absolute top-4 z-40 bg-[#2D2A26] text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-[#FFB800] flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200">
              <div className="w-6 h-6 rounded-full bg-[#FFB800] text-[#2D2A26] flex items-center justify-center shrink-0">
                <Check size={14} strokeWidth={3} />
              </div>
              <span className="text-xs font-black uppercase tracking-wide text-amber-100">
                {canvasToast}
              </span>
            </div>
          )}
        </div>

        <div className="w-full lg:w-96 border-l border-gray-100 flex flex-col bg-white overflow-hidden">
          <div className="flex border-b border-gray-100 shrink-0">
            {(['filters', 'stickers', 'animated', 'text'] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'text-[#FFB800] bg-gray-50 border-b-2 border-[#FFB800]' : 'text-gray-400'}`}
              >
                {tab === 'filters' && <Sparkles size={14} className="mx-auto mb-1" />}
                {tab === 'stickers' && <ImageIcon size={14} className="mx-auto mb-1" />}
                {tab === 'animated' && <Zap size={14} className="mx-auto mb-1" />}
                {tab === 'text' && <Type size={14} className="mx-auto mb-1" />}
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {activeTab === 'filters' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  {[
                    { key: 'brightness', label: 'Brilho', min: 0.5, max: 2, step: 0.01 },
                    { key: 'contrast', label: 'Contraste', min: 0.5, max: 2, step: 0.01 },
                    { key: 'saturate', label: 'Saturação', min: 0, max: 3, step: 0.01 },
                    { key: 'blur', label: 'Desfoque', min: 0, max: 10, step: 0.1 },
                    { key: 'sepia', label: 'Sépia', min: 0, max: 1, step: 0.01 },
                    { key: 'grayscale', label: 'P&B', min: 0, max: 1, step: 0.01 },
                    { key: 'hueRotate', label: 'Matiz', min: 0, max: 360, step: 1 },
                  ].map(f => (
                    <div key={f.key} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold uppercase text-gray-400">
                        <span>{f.label}</span>
                        <span>{filters[f.key as keyof FilterSettings]}</span>
                      </div>
                      <input 
                        type="range" 
                        min={f.min} max={f.max} step={f.step} 
                        value={filters[f.key as keyof FilterSettings]}
                        onChange={(e) => setFilters(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) }))}
                        className="w-full accent-[#FFB800]"
                      />
                    </div>
                  ))}
                  <button 
                    onClick={() => setFilters({ brightness: 1, contrast: 1, saturate: 1, sepia: 0, grayscale: 0, hueRotate: 0, blur: 0 })}
                    className="w-full text-[10px] font-black uppercase text-gray-400 hover:text-red-500 transition py-2"
                  >
                    Limpar Todos Efeitos
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'stickers' && (
              <div className="space-y-4">
                {/* Banner de Acesso à Gaveta de Assets Completa */}
                <div className="bg-[#2D2A26] text-white p-3.5 rounded-2xl border border-[#FFB800]/40 flex items-center justify-between shadow-md">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black uppercase text-[#FFB800] tracking-wider block">Catálogo Oficial</span>
                    <h4 className="text-xs font-black uppercase tracking-tight text-white">Gaveta de Assets</h4>
                    <p className="text-[10px] text-gray-300">Grafite, Bombing, Texturas & Setas</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAssetDrawerOpen(true)}
                    className="bg-[#FFB800] hover:bg-black hover:text-[#FFB800] text-[#2D2A26] px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition shrink-0 shadow flex items-center gap-1.5"
                  >
                    <Layers size={13} />
                    <span>Abrir ({ASSET_CATALOG.length})</span>
                  </button>
                </div>

                {/* Category filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'tag', label: 'Tags' },
                    { id: 'spray', label: 'Spray' },
                    { id: 'cerrado', label: 'Cerrado' },
                    { id: 'urban', label: 'Rua' },
                    { id: 'shapes', label: 'Símbolos' }
                  ].map(c => (
                    <button
                      key={c.id}
                      onClick={() => setStickerFilter(c.id as any)}
                      className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg whitespace-nowrap transition ${
                        stickerFilter === c.id
                          ? 'bg-[#FFB800] text-[#2D2A26] shadow-xs'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {STICKERS.filter(s => stickerFilter === 'all' || s.category === stickerFilter).map(sticker => (
                    <button 
                      key={sticker.id}
                      onClick={() => handleAddSticker(sticker.url)}
                      title={sticker.name}
                      className="aspect-square p-2 bg-gray-50 rounded-2xl hover:bg-[#FFB800]/15 hover:scale-105 transition flex flex-col items-center justify-center gap-1 border border-gray-100 hover:border-[#FFB800] group"
                    >
                      <img 
                        src={sticker.url} 
                        alt={sticker.name} 
                        referrerPolicy="no-referrer" 
                        className="w-10 h-10 object-contain transition group-hover:scale-110" 
                      />
                      <span className="text-[8px] font-bold text-gray-400 group-hover:text-[#2D2A26] truncate w-full text-center">
                        {sticker.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'animated' && (
              <div className="space-y-4">
                {/* Banner de Acesso aos Loops da Gaveta de Assets */}
                <div className="bg-gradient-to-r from-[#2D2A26] to-purple-950 text-white p-3.5 rounded-2xl border border-purple-500/40 flex items-center justify-between shadow-md">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase text-purple-300 tracking-wider">Animações em Loop</span>
                      <span className="bg-[#FFB800] text-[#2D2A26] text-[8px] font-black px-1.5 py-0.2 rounded-full">
                        {ANIMATED_STICKERS.length} LOOPS
                      </span>
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-tight text-white">Loops & Stickers Vivos</h4>
                    <p className="text-[10px] text-gray-300">Intervenções animadas em repetição contínua</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAssetDrawerOpen(true)}
                    className="bg-[#FFB800] hover:bg-black hover:text-[#FFB800] text-[#2D2A26] px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition shrink-0 shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap size={13} />
                    <span>Biblioteca</span>
                  </button>
                </div>

                {/* Filtros de Categoria para Loops Animados */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'urban', label: 'Urbano & Som' },
                    { id: 'spray', label: 'Spray & Drip' },
                    { id: 'shapes', label: 'Formas & Ritmo' },
                    { id: 'cerrado', label: 'Cerrado' }
                  ].map(c => (
                    <button
                      key={c.id}
                      onClick={() => setAnimatedFilter(c.id as any)}
                      className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer ${
                        animatedFilter === c.id
                          ? 'bg-[#FF5722] text-white shadow-xs'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Grid de Loops Animados com Live Preview e Nome */}
                <div className="grid grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {ANIMATED_STICKERS.filter(s => animatedFilter === 'all' || s.category === animatedFilter).map(sticker => (
                    <button 
                      key={sticker.id}
                      onClick={() => handleAddSticker(sticker.url, true)}
                      title={`Adicionar loop: ${sticker.name}`}
                      className="relative p-2.5 bg-gray-50 rounded-2xl hover:bg-purple-50/70 border border-gray-100 hover:border-purple-400 transition flex flex-col items-center justify-between gap-1.5 group cursor-pointer aspect-square overflow-hidden"
                    >
                      <div className="absolute top-2 left-2 bg-[#FF5722] text-white text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-xs z-10">
                        <Zap size={8} />
                        <span>Loop</span>
                      </div>
                      <div className="flex-1 w-full flex items-center justify-center pt-2">
                        <img 
                          src={sticker.url} 
                          alt={sticker.name} 
                          referrerPolicy="no-referrer" 
                          className="w-16 h-16 object-contain transition group-hover:scale-110 duration-200" 
                        />
                      </div>
                      <span className="text-[9px] font-bold text-gray-600 group-hover:text-[#2D2A26] truncate w-full text-center">
                        {sticker.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'text' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Estilo de Rua</p>
                  <div className="grid grid-cols-2 gap-2">
                    {STREET_FONTS.map(font => (
                      <button
                        key={font.id}
                        onClick={() => handleFontChange(font.family)}
                        style={{ fontFamily: font.family }}
                        className={`p-3 rounded-xl border-2 transition-all text-xs truncate text-center ${selectedFont === font.family ? 'border-[#FFB800] bg-[#FFB800]/10 text-[#2D2A26]' : 'border-gray-100 text-gray-400'}`}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Sua Tag</p>
                  <input 
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="DIGITE AQUI..."
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:outline-none focus:border-[#FFB800] font-bold text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
                  />
                  <button 
                    onClick={handleAddText}
                    className="w-full bg-[#2D2A26] text-white py-4 rounded-2xl font-bold uppercase text-xs hover:bg-black transition shadow-lg"
                  >
                    Lançar Texto
                  </button>
                </div>
              </div>
            )}

            {selectedLayerId && (
              <div className="pt-6 border-t border-gray-100 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#FFB800]">Ajustar Camada</h4>
                    {layers.find(l => l.id === selectedLayerId)?.type === 'animated-sticker' && (
                      <span className="bg-[#FFB800]/10 text-[#FFB800] text-[8px] px-2 py-0.5 rounded-full font-black uppercase">Animado</span>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      setLayers(layers.filter(l => l.id !== selectedLayerId));
                      setSelectedLayerId(null);
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[8px] font-bold uppercase text-gray-400">
                      <span>Tamanho</span>
                      <span>{layers.find(l => l.id === selectedLayerId)?.size}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="40" max="700" step="1" 
                      value={layers.find(l => l.id === selectedLayerId)?.size || 200}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setLayers(layers.map(l => l.id === selectedLayerId ? { ...l, size: val } : l));
                      }}
                      className="w-full accent-[#FFB800]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[8px] font-bold uppercase text-gray-400">
                      <span>Giro</span>
                      <span>{layers.find(l => l.id === selectedLayerId)?.rotation}°</span>
                    </div>
                    <input 
                      type="range" 
                      min="-180" max="180" step="1" 
                      value={layers.find(l => l.id === selectedLayerId)?.rotation || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setLayers(layers.map(l => l.id === selectedLayerId ? { ...l, rotation: val } : l));
                      }}
                      className="w-full accent-[#FFB800]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[8px] font-bold uppercase text-gray-400">
                      <span>Opacidade</span>
                      <span>{Math.round((layers.find(l => l.id === selectedLayerId)?.opacity || 1) * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01" 
                      value={layers.find(l => l.id === selectedLayerId)?.opacity || 1}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setLayers(layers.map(l => l.id === selectedLayerId ? { ...l, opacity: val } : l));
                      }}
                      className="w-full accent-[#FFB800]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gaveta de Assets Urbano Completo com Pesquisa, Categorias e Paginação Sob Demanda */}
      <AssetDrawer
        isOpen={isAssetDrawerOpen}
        onClose={() => setIsAssetDrawerOpen(false)}
        onSelectAsset={handleSelectAsset}
      />
    </div>
  );
};

export default Editor;
