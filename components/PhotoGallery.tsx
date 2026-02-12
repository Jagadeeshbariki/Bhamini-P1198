
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 px-4">
                {images.map((image, index) => (
                    <div key={index} onClick={() => openLightbox(index)} className="cursor-pointer">
                        <GalleryItem image={image} index={index} />
                    </div>
                ))}
            </div>

            {/* Lightbox Overlay */}
            {selectedIndex !== null && (
                <div 
                    className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex flex-col items-center animate-fade-in"
                    onClick={closeLightbox}
                >
                    {/* 1. TOP BAR (Heading & Close Button) */}
                    <div className="w-full max-w-6xl px-6 pt-8 pb-4 flex justify-between items-start z-50" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col gap-2 max-w-[80%] animate-slide-down">
                            <div className="flex items-center gap-3">
                                <span className="px-4 py-1.5 bg-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-lg">
                                    Archive Item {selectedIndex + 1} / {images.length}
                                </span>
                            </div>
                            {images[selectedIndex].description && images[selectedIndex].description.trim() !== "" ? (
                                <h3 className="text-white text-xl sm:text-2xl font-black tracking-tight leading-tight drop-shadow-md">
                                    {images[selectedIndex].description}
                                </h3>
                            ) : (
                                <h3 className="text-white/30 text-xs font-black uppercase tracking-widest italic">Documented Activity (No Caption)</h3>
                            )}
                        </div>

                        <button 
                            onClick={closeLightbox}
                            className="p-4 bg-white/10 backdrop-blur-md text-white/90 hover:text-white hover:bg-red-500 rounded-full transition-all shadow-2xl border border-white/20 active:scale-90"
                            title="Close Viewer"
                        >
                            <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>

                    {/* 2. IMAGE CONTENT (Below Heading) */}
                    <div 
                        className="relative flex-grow w-full flex items-center justify-center p-4 sm:p-10 mb-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Navigation Buttons (Sides) */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); prevImage(); }}
                            className="absolute left-4 sm:left-10 top-1/2 -translate-y-1/2 p-5 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all z-20 group"
                            aria-label="Previous Image"
                        >
                            <svg className="w-10 h-10 sm:w-12 sm:h-12 transform group-hover:-translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                        </button>

                        <button 
                            onClick={(e) => { e.stopPropagation(); nextImage(); }}
                            className="absolute right-4 sm:right-10 top-1/2 -translate-y-1/2 p-5 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all z-20 group"
                            aria-label="Next Image"
                        >
                            <svg className="w-10 h-10 sm:w-12 sm:h-12 transform group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                        </button>

                        <img 
                            src={images[selectedIndex].url} 
                            alt={images[selectedIndex].description || "Field documentation"} 
                            className="max-w-full max-h-[75vh] object-contain rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-scale-up border border-white/10"
                        />
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scale-up { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
                @keyframes slide-down { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .animate-scale-up { animation: scale-up 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
                .animate-slide-down { animation: slide-down 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};

const GalleryItem: React.FC<{ image: GalleryImage; index: number }> = ({ image, index }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div className="group relative overflow-hidden rounded-[2.5rem] shadow-xl bg-gray-100 dark:bg-gray-800 aspect-square border-4 border-white dark:border-gray-800 hover:shadow-indigo-500/20 transition-all duration-500">
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
                </div>
            )}
            <img
                src={image.url}
                alt={image.description || `Field Doc ${index + 1}`}
                onLoad={() => setIsLoaded(true)}
                className={`w-full h-full object-cover transform transition-all duration-1000 ease-in-out group-hover:scale-110 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6">
                <span className="text-[9px] text-indigo-400 font-black uppercase tracking-[0.2em] mb-2">Project Archive</span>
                {image.description && image.description.trim() !== "" ? (
                    <p className="text-white text-xs font-black leading-tight line-clamp-3 uppercase tracking-tight">
                        {image.description}
                    </p>
                ) : (
                    <span className="text-white/60 text-[10px] font-black uppercase tracking-widest">Documented Activity</span>
                )}
            </div>
        </div>
    );
};

export default PhotoGallery;
