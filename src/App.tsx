/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Sparkles, 
  Image as ImageIcon, 
  Type as TypeIcon, 
  Users, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Download,
  Wand2,
  Settings2,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { BookConfig, StoryBook, Genre, ArtStyle, PaperSize } from './types';
import { generateStoryStructure, generateImage } from './services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [step, setStep] = useState<'config' | 'generating' | 'viewing'>('config');
  const [isReady, setIsReady] = useState(false);
  const [config, setConfig] = useState<BookConfig>({
    title: '',
    genre: 'fantasy',
    artStyle: 'watercolor',
    paperSize: '1:1',
    pageCount: 5,
    characterConsistency: true,
    targetAge: '5-8',
    mainCharacterDesc: 'เด็กชายผมสีน้ำตาล ใส่เสื้อคลุมสีน้ำเงิน มีกระเป๋าสะพายใบเล็ก',
    additionalNotes: ''
  });

  const [book, setBook] = useState<StoryBook | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasKey, setHasKey] = useState(false);
  const [manualKey, setManualKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [genStatus, setGenStatus] = useState<{
    stage: 'text' | 'images' | 'done' | 'error';
    progress: number;
    total: number;
    currentTask: string;
    errorMessage?: string;
  }>({ stage: 'text', progress: 0, total: 0, currentTask: '' });

  useEffect(() => {
    const checkKey = async () => {
      console.log("Checking API Key...");
      try {
        // 1. Check process.env safely
        const envKey = process.env?.GEMINI_API_KEY;
        if (envKey && envKey !== "MY_GEMINI_API_KEY" && envKey !== "") {
          console.log("Key found in environment");
          setHasKey(true);
          setIsReady(true);
          return;
        }

        // 2. Check AI Studio environment
        if (window.aistudio?.hasSelectedApiKey) {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasKey(selected);
          if (!selected) setShowKeyInput(true);
        } else {
          // 3. Check localStorage
          const localKey = localStorage.getItem('GEMINI_API_KEY');
          if (localKey) {
            setHasKey(true);
          } else {
            setShowKeyInput(true);
          }
        }
      } catch (e) {
        console.error("Key check error:", e);
        setShowKeyInput(true);
      } finally {
        setIsReady(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    } else {
      setShowKeyInput(true);
    }
  };

  const saveManualKey = () => {
    if (manualKey.trim()) {
      // We'll set it in a way that our service can pick it up
      // Since we can't easily change process.env at runtime, 
      // we'll store it in localStorage and the service will check it.
      localStorage.setItem('GEMINI_API_KEY', manualKey.trim());
      setHasKey(true);
      setShowKeyInput(false);
      setManualKey('');
    }
  };

  const handleStartGeneration = async () => {
    if (!hasKey && !process.env.GEMINI_API_KEY) {
      setShowKeyInput(true);
      return;
    }
    setStep('generating');
    setGenStatus({ stage: 'text', progress: 0, total: 1, currentTask: 'กำลังรังสรรค์เนื้อเรื่อง...' });
    
    try {
      // 1. Generate Story Structure
      const storyStructure = await generateStoryStructure(config);
      setBook(storyStructure);
      
      // 2. Generate Images
      const totalImages = storyStructure.pages.length + 2; // Pages + Front + Back
      setGenStatus({ stage: 'images', progress: 0, total: totalImages, currentTask: 'กำลังวาดภาพประกอบ...' });

      const updatedBook = { ...storyStructure };
      
      // Front Cover
      const frontPrompt = `${updatedBook.frontCover.imagePrompt}, ${config.artStyle} style, high quality, children's book illustration, ${config.characterConsistency ? updatedBook.characterVisualProfile : ''}`;
      updatedBook.frontCover.imageUrl = await generateImage(frontPrompt, config.paperSize);
      setGenStatus(prev => ({ ...prev, progress: 1, currentTask: 'วาดหน้าปกเสร็จแล้ว...' }));

      // Pages
      for (let i = 0; i < updatedBook.pages.length; i++) {
        const page = updatedBook.pages[i];
        const pagePrompt = `${page.imagePrompt}, ${config.artStyle} style, high quality, children's book illustration, ${config.characterConsistency ? updatedBook.characterVisualProfile : ''}`;
        page.imageUrl = await generateImage(pagePrompt, config.paperSize);
        setGenStatus(prev => ({ ...prev, progress: i + 2, currentTask: `กำลังวาดหน้าที่ ${i + 1}...` }));
      }

      // Back Cover
      const backPrompt = `${updatedBook.backCover.imagePrompt}, ${config.artStyle} style, high quality, children's book illustration, minimalist, ${config.characterConsistency ? updatedBook.characterVisualProfile : ''}`;
      updatedBook.backCover.imageUrl = await generateImage(backPrompt, config.paperSize);
      
      setBook(updatedBook);
      setGenStatus({ stage: 'done', progress: totalImages, total: totalImages, currentTask: 'เสร็จสมบูรณ์!' });
      
      setTimeout(() => setStep('viewing'), 1000);
    } catch (error: any) {
      console.error(error);
      const errorStr = error.message || error.toString();
      const isQuotaError = errorStr.includes('quota') || errorStr.includes('429') || errorStr.includes('limit');
      const isHighDemand = errorStr.includes('503') || errorStr.includes('high demand');
      const isSafetyError = errorStr.includes('SAFETY_FILTER');
      
      let message = 'เกิดข้อผิดพลาดในการสื่อสารกับ AI กรุณาลองใหม่อีกครั้ง';
      if (isQuotaError) {
        message = 'ขออภัย คุณใช้งานเกิน 5 ครั้งต่อนาที (Rate Limit) ระบบกำลังรอคิวให้ว่าง กรุณารอประมาณ 30 วินาทีแล้วกด "ลองใหม่อีกครั้ง"';
      } else if (isHighDemand) {
        message = 'ขออภัย ขณะนี้มีผู้ใช้งาน Gemini จำนวนมาก (High Demand) ทำให้ระบบติดขัดชั่วคราว กรุณารอประมาณ 10-20 วินาทีแล้วกด "ลองใหม่อีกครั้ง"';
      } else if (isSafetyError) {
        message = 'เนื้อหาบางส่วนถูกระงับโดยระบบความปลอดภัยของ AI (Safety Filter) กรุณาลองปรับคำอธิบายตัวละครให้เรียบง่ายขึ้น';
      }

      setGenStatus({ 
        stage: 'error', 
        progress: 0, 
        total: 0, 
        currentTask: 'เกิดข้อผิดพลาด',
        errorMessage: message
      });
    }
  };

  const totalPages = book ? book.pages.length + 2 : 0; // Front + Pages + Back

  const renderConfig = () => (
    <div className="max-w-4xl mx-auto p-6 md:p-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 text-orange-600 mb-4 animate-float">
          <Wand2 size={32} />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold serif-title mb-4">Magic Book Builder</h1>
        <p className="text-stone-500 text-lg">รังสรรค์นิทานในฝันของคุณด้วยพลังแห่ง AI</p>
        
        {!hasKey && (
          <button 
            onClick={handleSelectKey}
            className="mt-4 text-xs text-orange-600 hover:underline flex items-center gap-1 mx-auto"
          >
            <Settings2 size={12} />
            ใช้ API Key ของคุณเองเพื่อเพิ่มโควต้า
          </button>
        )}
        {hasKey && (
          <div className="mt-4 text-xs text-green-600 flex items-center gap-1 mx-auto justify-center">
            <CheckCircle2 size={12} />
            กำลังใช้งานด้วย API Key ส่วนตัว
            <button 
              onClick={() => setShowKeyInput(true)}
              className="ml-2 text-stone-400 hover:text-orange-500 underline transition-colors"
            >
              แก้ไข
            </button>
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-stone-800 font-semibold">
              <BookOpen size={20} className="text-orange-500" />
              <h2>รายละเอียดนิทาน</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">แนวเรื่อง</label>
                <select 
                  value={config.genre}
                  onChange={(e) => setConfig({...config, genre: e.target.value as Genre})}
                  className="w-full p-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                >
                  <option value="fantasy">แฟนตาซี (Fantasy)</option>
                  <option value="adventure">ผจญภัย (Adventure)</option>
                  <option value="bedtime">นิทานก่อนนอน (Bedtime)</option>
                  <option value="educational">ความรู้/การศึกษา (Educational)</option>
                  <option value="fable">นิทานอีสป/คติสอนใจ (Fable)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">ช่วงอายุ</label>
                <select 
                  value={config.targetAge}
                  onChange={(e) => setConfig({...config, targetAge: e.target.value})}
                  className="w-full p-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                >
                  <option value="3-5">3-5 ปี</option>
                  <option value="5-8">5-8 ปี</option>
                  <option value="8-12">8-12 ปี</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">จำนวนหน้า (ไม่รวมปก)</label>
                <input 
                  type="range" min="3" max="10" 
                  value={config.pageCount}
                  onChange={(e) => setConfig({...config, pageCount: parseInt(e.target.value)})}
                  className="w-full accent-orange-500"
                />
                <div className="text-right text-xs text-stone-400 mt-1">{config.pageCount} หน้า</div>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-stone-800 font-semibold">
              <ImageIcon size={20} className="text-orange-500" />
              <h2>สไตล์ภาพและรูปเล่ม</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">สไตล์ภาพ</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['watercolor', 'cartoon', 'realistic', 'oil-painting', 'sketch', '3d-render'] as ArtStyle[]).map((style) => (
                    <button
                      key={style}
                      onClick={() => setConfig({...config, artStyle: style})}
                      className={cn(
                        "px-3 py-2 text-xs rounded-lg border transition-all capitalize",
                        config.artStyle === style 
                          ? "bg-orange-50 border-orange-200 text-orange-700 font-medium" 
                          : "border-stone-100 text-stone-500 hover:bg-stone-50"
                      )}
                    >
                      {style.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">ขนาดกระดาษ</label>
                <div className="flex gap-4">
                  {(['1:1', '3:4', '4:3'] as PaperSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => setConfig({...config, paperSize: size})}
                      className={cn(
                        "flex-1 py-2 rounded-lg border transition-all text-sm",
                        config.paperSize === size 
                          ? "bg-orange-50 border-orange-200 text-orange-700 font-medium" 
                          : "border-stone-100 text-stone-500 hover:bg-stone-50"
                      )}
                    >
                      {size === '1:1' ? 'จัตุรัส' : size === '3:4' ? 'แนวตั้ง' : 'แนวนอน'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm h-full">
            <div className="flex items-center gap-2 mb-4 text-stone-800 font-semibold">
              <Users size={20} className="text-orange-500" />
              <h2>ตัวละครและเนื้อหา</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">ลักษณะตัวละครหลัก</label>
                <textarea 
                  value={config.mainCharacterDesc}
                  onChange={(e) => setConfig({...config, mainCharacterDesc: e.target.value})}
                  placeholder="เช่น กระต่ายสีขาวใส่แว่น, เด็กหญิงผมเปียชุดแดง..."
                  className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all h-32 resize-none text-sm"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                <div className="text-sm font-medium text-stone-700">รักษาความคงที่ของตัวละคร</div>
                <button 
                  onClick={() => setConfig({...config, characterConsistency: !config.characterConsistency})}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    config.characterConsistency ? "bg-orange-500" : "bg-stone-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    config.characterConsistency ? "left-7" : "left-1"
                  )} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">หมายเหตุเพิ่มเติม (ถ้ามี)</label>
                <input 
                  type="text"
                  value={config.additionalNotes}
                  onChange={(e) => setConfig({...config, additionalNotes: e.target.value})}
                  placeholder="เช่น เน้นความกล้าหาญ, มีฉากในป่า..."
                  className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all text-sm"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-12 text-center">
        <button 
          onClick={handleStartGeneration}
          className="px-12 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 mx-auto group"
        >
          <Sparkles className="group-hover:rotate-12 transition-transform" />
          สร้างนิทานด้วยเวทมนตร์
        </button>
      </div>
    </div>
  );

  const renderGenerating = () => (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      {genStatus.stage === 'error' ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md"
        >
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <RotateCcw size={40} />
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-4">อุ๊ปส์! พลังเวทมนตร์ติดขัด</h2>
          <p className="text-stone-500 mb-8 leading-relaxed">
            {genStatus.errorMessage}
          </p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={handleStartGeneration}
              className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all"
            >
              ลองใหม่อีกครั้ง
            </button>
            <button 
              onClick={() => setStep('config')}
              className="px-8 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all"
            >
              กลับไปแก้ไขรายละเอียด
            </button>
          </div>
        </motion.div>
      ) : (
        <>
          <div className="relative w-48 h-48 mb-8">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-4 border-dashed border-orange-200 rounded-full"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={64} className="text-orange-500 animate-spin" />
            </div>
          </div>
          
          <h2 className="text-3xl font-bold serif-title mb-2">กำลังร่ายมนตร์...</h2>
          <p className="text-stone-500 mb-8">{genStatus.currentTask}</p>
          
          <div className="w-full max-w-md bg-stone-100 h-2 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(genStatus.progress / genStatus.total) * 100}%` }}
              className="h-full bg-orange-500"
            />
          </div>
          <div className="mt-2 text-sm text-stone-400">
            {genStatus.progress} / {genStatus.total} ขั้นตอน
          </div>
        </>
      )}
    </div>
  );

  const renderViewing = () => {
    if (!book) return null;

    const isFront = currentPage === 0;
    const isBack = currentPage === totalPages - 1;
    const pageIndex = currentPage - 1;
    const page = !isFront && !isBack ? book.pages[pageIndex] : null;

    const getAspectRatioClass = () => {
      switch(config.paperSize) {
        case '3:4': return 'aspect-[3/4]';
        case '4:3': return 'aspect-[4/3]';
        default: return 'aspect-square';
      }
    };

    return (
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => setStep('config')}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors"
          >
            <RotateCcw size={18} />
            สร้างเล่มใหม่
          </button>
          <div className="text-stone-400 font-medium">
            หน้า {currentPage + 1} / {totalPages}
          </div>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 text-orange-600 hover:text-orange-700 transition-colors"
          >
            <Download size={18} />
            พิมพ์ / บันทึก
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button 
            disabled={currentPage === 0}
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            className="p-3 rounded-full bg-white border border-stone-200 text-stone-400 hover:text-orange-500 disabled:opacity-30 transition-all shadow-sm"
          >
            <ChevronLeft size={24} />
          </button>

          <div className={cn("flex-1 book-page rounded-2xl overflow-hidden flex flex-col md:flex-row", getAspectRatioClass())}>
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentPage}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col md:flex-row h-full"
              >
                {/* Image Section */}
                <div className="flex-1 bg-stone-50 relative">
                  {isFront && book.frontCover.imageUrl && (
                    <img src={book.frontCover.imageUrl} className="w-full h-full object-cover" alt="Cover" referrerPolicy="no-referrer" />
                  )}
                  {isBack && book.backCover.imageUrl && (
                    <img src={book.backCover.imageUrl} className="w-full h-full object-cover" alt="Back Cover" referrerPolicy="no-referrer" />
                  )}
                  {page && page.imageUrl && (
                    <img src={page.imageUrl} className="w-full h-full object-cover" alt={`Page ${page.pageNumber}`} referrerPolicy="no-referrer" />
                  )}
                  {!isFront && !isBack && !page?.imageUrl && (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <ImageIcon size={48} />
                    </div>
                  )}
                </div>

                {/* Text Section */}
                <div className="w-full md:w-1/3 p-8 md:p-12 flex flex-col justify-center bg-white border-l border-stone-100">
                  {isFront && (
                    <div className="text-center">
                      <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4 block">หน้าปก</span>
                      <h1 className="text-3xl md:text-4xl font-bold serif-title mb-6 leading-tight">{book.title}</h1>
                      <div className="w-12 h-1 bg-orange-200 mx-auto mb-6" />
                      <p className="text-stone-400 italic text-sm">เรื่องและภาพโดย Magic AI</p>
                    </div>
                  )}
                  {isBack && (
                    <div className="text-center">
                      <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4 block">ปกหลัง</span>
                      <p className="text-stone-600 leading-relaxed mb-8 serif-title text-lg italic">"{book.backCover.text}"</p>
                      <div className="pt-8 border-t border-stone-100">
                        <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                        <p className="text-stone-400 text-xs">นิทานเรื่องนี้สร้างเสร็จสมบูรณ์แล้ว</p>
                      </div>
                    </div>
                  )}
                  {page && (
                    <div>
                      <span className="text-xs font-bold text-stone-300 mb-4 block">หน้า {page.pageNumber}</span>
                      <p className="text-stone-700 leading-relaxed text-lg serif-title first-letter:text-4xl first-letter:font-bold first-letter:text-orange-500 first-letter:mr-1">
                        {page.text}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <button 
            disabled={currentPage === totalPages - 1}
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            className="p-3 rounded-full bg-white border border-stone-200 text-stone-400 hover:text-orange-500 disabled:opacity-30 transition-all shadow-sm"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="mt-12 grid grid-cols-10 gap-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                currentPage === i ? "bg-orange-500 w-full" : "bg-stone-200 hover:bg-stone-300"
              )}
            />
          ))}
        </div>
      </div>
    );
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center">
        <Loader2 className="text-orange-500 animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7] selection:bg-orange-100 selection:text-orange-900 relative">
      {/* Global Settings Button */}
      <button 
        onClick={() => setShowKeyInput(true)}
        className="fixed top-4 right-4 z-40 p-2 bg-white/80 backdrop-blur-md border border-stone-200 rounded-full text-stone-400 hover:text-orange-500 hover:border-orange-200 transition-all shadow-sm"
        title="ตั้งค่า API Key"
      >
        <Settings2 size={20} />
      </button>

      <main className="container mx-auto py-8">
        {step === 'config' && renderConfig()}
        {step === 'generating' && renderGenerating()}
        {step === 'viewing' && renderViewing()}
      </main>

      {/* Manual API Key Modal */}
      <AnimatePresence>
        {showKeyInput && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-6">
                <Settings2 size={24} />
              </div>
              <h2 className="text-2xl font-bold text-stone-800 mb-2">
                {localStorage.getItem('GEMINI_API_KEY') ? 'แก้ไข Gemini API Key' : 'กรุณาใส่ Gemini API Key'}
              </h2>
              <p className="text-stone-500 text-sm mb-6">
                เนื่องจากคุณไม่ได้ใช้งานผ่าน AI Studio คุณจำเป็นต้องระบุ API Key เพื่อใช้งานระบบสร้างนิทาน (คีย์จะถูกเก็บไว้ในเบราว์เซอร์ของคุณเท่านั้น)
              </p>
              
              <input 
                type="password"
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-500/20 outline-none mb-6"
              />
              
              <div className="flex gap-3">
                <button 
                  onClick={saveManualKey}
                  className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all"
                >
                  บันทึกและใช้งาน
                </button>
                {localStorage.getItem('GEMINI_API_KEY') && (
                  <button 
                    onClick={() => {
                      localStorage.removeItem('GEMINI_API_KEY');
                      setHasKey(false);
                      setShowKeyInput(false);
                    }}
                    className="px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all"
                    title="ลบคีย์ที่บันทึกไว้"
                  >
                    ลบคีย์
                  </button>
                )}
                <button 
                  onClick={() => setShowKeyInput(false)}
                  className="px-6 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all"
                >
                  ยกเลิก
                </button>
              </div>
              
              <p className="mt-6 text-[10px] text-stone-400 text-center">
                คุณสามารถรับ API Key ได้ฟรีที่ <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-orange-400 underline">Google AI Studio</a>
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
