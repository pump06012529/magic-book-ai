export type ArtStyle = 'watercolor' | 'cartoon' | 'realistic' | 'oil-painting' | 'sketch' | '3d-render';
export type PaperSize = '1:1' | '3:4' | '4:3' | 'A4-Portrait' | 'A4-Landscape';
export type Genre = 'fantasy' | 'adventure' | 'bedtime' | 'educational' | 'fable';

export interface BookConfig {
  title: string;
  genre: Genre;
  artStyle: ArtStyle;
  paperSize: PaperSize;
  pageCount: number;
  characterConsistency: boolean;
  targetAge: string;
  mainCharacterDesc: string;
  additionalNotes: string;
}

export interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
  imageUrl?: string;
}

export interface StoryBook {
  title: string;
  frontCover: {
    title: string;
    imagePrompt: string;
    imageUrl?: string;
  };
  pages: StoryPage[];
  backCover: {
    text: string;
    imagePrompt: string;
    imageUrl?: string;
  };
  characterVisualProfile?: string;
}
