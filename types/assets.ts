export type AssetType = 'static_sticker' | 'animated_sticker';

export type AssetCategory =
  | 'Grafite & Bombing'
  | 'Cultura de Rua'
  | 'Tipografia Urbana'
  | 'Texturas & Rasgos'
  | 'Símbolos & Badges'
  | 'Linhas & Setas de Intervenção'
  | 'Animações em Loop';

export interface AssetItem {
  id: string;
  name: string;
  category: AssetCategory;
  type: AssetType;
  url: string;
  thumbnailUrl?: string;
  tags: string[]; // array para busca textual rápida
  aspectRatio: number; // width / height (ex: 1.0 para quadrado)
  animationMetadata?: {
    frameCount?: number;
    durationMs?: number;
    loop?: boolean;
  };
}
