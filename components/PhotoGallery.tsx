
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

    // Keyboard navigation
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
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center animate-fade-in"
                    onClick={closeLightbox}
                >
                    {/* Navigation Buttons */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); prevImage(); }}
                        className="absolute left-4 sm:left-10 top-1/2 -translate-y-1/2 p-4 text-white hover:bg-white/10 rounded-full transition-all z-20 group"
                        aria-label="Previous Image"
                    >
                        <svg className="w-8 h-8 sm:w-10 sm:h-10 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                    </button>

                    <button 
                        onClick={(e) => { e.stopPropagation(); nextImage(); }}
                        className="absolute right-4 sm:right-10 top-1/2 -translate-y-1/2 p-4 text-white hover:bg-white/10 rounded-full transition-all z-20 group"
                        aria-label="Next Image"
                    >
                        <svg className="w-8 h-8 sm:w-10 sm:h-10 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                    </button>

                    {/* Close Button - Moved below site header (top-20) */}
                    <button 
                        onClick={closeLightbox}
                        className="absolute top-20 right-6 p-4 bg-white/10 backdrop-blur-md text-white/90 hover:text-white hover:bg-white/20 rounded-full transition-all z-20 shadow-xl border border-white/20"
                        title="Close Viewer"
                    >
                        <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>

                    {/* Image Container */}
                    <div 
                        className="relative max-w-5xl w-full h-[80vh] flex flex-col items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img 
                            src={images[selectedIndex].url} 
                            alt={images[selectedIndex].description || "Field documentation"} 
                            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-scale-up"
                        />
                        
                        {/* Caption & Counter Panel */}
                        <div className="mt-8 bg-white/10 backdrop-blur-xl border border-white/20 px-8 py-5 rounded-[2rem] shadow-2xl text-center max-w-2xl animate-slide-up">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <span className="px-3 py-1 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest text-white">
                                    {selectedIndex + 1} of {images.length}
                                </span>
                            </div>
                            {images[selectedIndex].description && (
                                <p className="text-white text-lg font-bold leading-tight drop-shadow-md">
                                    {images[selectedIndex].description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-up {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes slide-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .animate-scale-up { animation: scale-up 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
                .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
            `}</style>
        </div>
    );
};

const GalleryItem: React.FC<{ image: GalleryImage; index: number }> = ({ image, index }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div className="group relative overflow-hidden rounded-2xl shadow-md bg-gray-100 dark:bg-gray-800 aspect-square sm:aspect-video border border-gray-100 dark:border-gray-700">
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
            )}
            <img
                src={image.url}
                alt={image.description || `Field Doc ${index + 1}`}
                onLoad={() => setIsLoaded(true)}
                className={`w-full h-full object-cover transform transition-all duration-700 ease-in-out group-hover:scale-110 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
            />
            
            {/* Hover Overlay with Description */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest mb-1">Field Registry</span>
                {image.description ? (
                    <p className="text-white text-[11px] font-bold leading-tight line-clamp-2">
                        {image.description}
                    </p>
                ) : (
                    <span className="text-white text-[10px] font-bold uppercase tracking-widest">View Full Photo</span>
                )}
            </div>
        </div>
    );
};

export default PhotoGallery;
