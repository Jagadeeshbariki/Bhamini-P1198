
import React, { useState, useEffect, useCallback } from 'react';

interface GalleryImage {
    url: string;
    description?: string;
}

interface PhotoGalleryProps {
    images: GalleryImage[];
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ images }) => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const openLightbox = (index: number) => setSelectedIndex(index);
    const closeLightbox = () => setSelectedIndex(null);

    const nextImage = useCallback(() => {
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex + 1) % images.length);
        }
    }, [selectedIndex, images.length]);

    const prevImage = useCallback(() => {
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
        }
    }, [selectedIndex, images.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedIndex === null) return;
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
            if (e.key === 'Escape') closeLightbox();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIndex, nextImage, prevImage]);

    return (
        <div className="relative">
            {/* Main Grid View */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 px-2 md:px-4">
                {images.map((image, index) => (
                    <div key={index} onClick={() => openLightbox(index)} className="cursor-pointer">
                        <GalleryItem image={image} index={index} />
                    </div>
                ))}
            </div>

            {/* Lightbox Overlay */}
            {selectedIndex !== null && (
                <div 
                    className="fixed inset-0 z-[10000] bg-black flex flex-col items-center animate-fade-in select-none"
                    onClick={closeLightbox}
                >
                    {/* FIXED TOP UI: HEADING AND CLOSE BUTTON */}
                    <div className="fixed top-0 left-0 right-0 z-[10001] flex flex-col items-center py-8 gap-4 pointer-events-none">
                        {/* 1. HEADING (Archive Item Badge) */}
                        <div className="pointer-events-auto bg-indigo-600 px-6 py-2.5 rounded-full shadow-[0_10px_30px_rgba(79,70,229,0.5)] border border-white/20 animate-slide-down">
                            <span className="text-[11px] md:text-xs font-black uppercase tracking-[0.3em] text-white whitespace-nowrap">
                                ITEM {selectedIndex + 1} / {images.length}
                            </span>
                        </div>

                        {/* 2. CLOSE BUTTON: Explicitly positioned below the heading as requested */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
                            className="pointer-events-auto flex items-center gap-3 px-8 py-3 bg-white/10 hover:bg-red-600 border border-white/10 backdrop-blur-xl rounded-full text-white transition-all shadow-2xl active:scale-90 group animate-slide-down-delayed"
                            aria-label="Close Gallery"
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80 group-hover:opacity-100">Close Image</span>
                            <div className="w-5 h-5 flex items-center justify-center">
                                <svg className="w-full h-full group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </div>
                        </button>
                    </div>

                    {/* MAIN IMAGE: Centered and maximized */}
                    <div 
                        className="w-full h-full flex items-center justify-center p-4 md:p-12 pt-40" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="relative w-full h-full flex items-center justify-center">
                            {/* Desktop Nav Arrows (Always Fixed) */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                                className="hidden md:flex fixed left-8 top-1/2 -translate-y-1/2 w-16 h-16 items-center justify-center text-white/20 hover:text-white transition-all z-20 group"
                                aria-label="Previous"
                            >
                                <svg className="w-12 h-12 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
                            </button>

                            <button 
                                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                                className="hidden md:flex fixed right-8 top-1/2 -translate-y-1/2 w-16 h-16 items-center justify-center text-white/20 hover:text-white transition-all z-20 group"
                                aria-label="Next"
                            >
                                <svg className="w-12 h-12 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                            </button>

                            {/* The Image View */}
                            <div className="w-full h-full flex items-center justify-center animate-scale-up">
                                <img 
                                    src={images[selectedIndex].url} 
                                    alt={images[selectedIndex].description || "Field documentation image"} 
                                    className="max-w-full max-h-[75vh] md:max-h-full object-contain pointer-events-auto shadow-[0_0_80px_rgba(0,0,0,0.5)]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* FIXED BOTTOM: Description and mobile controls */}
                    <div className="fixed bottom-10 left-0 right-0 z-[10001] px-6 flex flex-col items-center pointer-events-none">
                        {images[selectedIndex].description && images[selectedIndex].description.trim() !== "" && (
                            <div className="max-w-2xl bg-black/50 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 animate-slide-up pointer-events-auto mb-6 shadow-2xl">
                                <p className="text-white text-xs sm:text-sm font-bold tracking-tight uppercase text-center leading-tight">
                                    {images[selectedIndex].description}
                                </p>
                            </div>
                        )}

                        {/* Mobile Navigation Buttons */}
                        <div className="flex md:hidden items-center gap-20 pointer-events-auto">
                            <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="p-4 bg-white/5 rounded-full text-white/30 active:text-white active:scale-90 transition-all border border-white/10">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="p-4 bg-white/5 rounded-full text-white/30 active:text-white active:scale-90 transition-all border border-white/10">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scale-up { from { opacity: 0; transform: scale(0.99); } to { opacity: 1; transform: scale(1); } }
                @keyframes slide-down { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .animate-scale-up { animation: scale-up 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
                .animate-slide-down { animation: slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-slide-down-delayed { 
                    animation: slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards; 
                    opacity: 0; 
                }
                .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};

const GalleryItem: React.FC<{ image: GalleryImage; index: number }> = ({ image, index }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div className="group relative overflow-hidden rounded-xl md:rounded-2xl shadow-sm bg-gray-100 dark:bg-gray-800 aspect-square border border-gray-100 dark:border-gray-700 hover:shadow-indigo-500/30 transition-all duration-500">
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
                </div>
            )}
            <img
                src={image.url}
                alt={image.description || `Field Record ${index + 1}`}
                onLoad={() => setIsLoaded(true)}
                className={`w-full h-full object-cover transform transition-all duration-700 ease-in-out group-hover:scale-110 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-3">
                <p className="text-white text-[9px] font-black uppercase tracking-widest line-clamp-1">
                    {image.description || "Open Record"}
                </p>
            </div>
        </div>
    );
};

export default PhotoGallery;
