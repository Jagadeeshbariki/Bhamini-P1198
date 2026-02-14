
import React, { useState, useEffect, useCallback } from 'react';

interface SliderImage {
    url: string;
    description?: string;
}

interface PhotoSliderProps {
    images: SliderImage[];
}

const PhotoSlider: React.FC<PhotoSliderProps> = ({ images }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const nextSlide = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, [images.length]);

    const prevSlide = () => {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
    };

    useEffect(() => {
        if (images.length <= 1) return;
        const slideInterval = setInterval(nextSlide, 6000);
        return () => clearInterval(slideInterval);
    }, [nextSlide, images.length]);

    if (!images || images.length === 0) return null;

    return (
        <div className="relative w-full max-w-5xl mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white dark:border-gray-800 group">
            <div className="relative h-64 sm:h-80 md:h-[500px] w-full bg-gray-200 dark:bg-gray-900 overflow-hidden">
                {images.map((img, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-all duration-1000 ease-in-out transform ${
                            index === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                        }`}
                    >
                        <img 
                            src={img.url} 
                            alt={img.description || `Field Photo ${index + 1}`} 
                            className="w-full h-full object-cover" 
                            loading="lazy" 
                        />
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
                        
                        {index === currentIndex && (
                            <div className="absolute bottom-4 left-4 z-20 animate-description-entry">
                                <div className="bg-black/50 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-xl max-w-xs">
                                    <p className="text-white text-[11px] font-bold tracking-tight leading-snug">
                                        {img.description && img.description.trim() !== "" 
                                            ? img.description 
                                            : "Project Highlight"}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {images.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute top-1/2 left-4 -translate-y-1/2 bg-black/20 backdrop-blur-sm text-white p-2 rounded-full hover:bg-indigo-600 transition-all opacity-0 group-hover:opacity-100 z-30"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <button
                        onClick={nextSlide}
                        className="absolute top-1/2 right-4 -translate-y-1/2 bg-black/20 backdrop-blur-sm text-white p-2 rounded-full hover:bg-indigo-600 transition-all opacity-0 group-hover:opacity-100 z-30"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                    </button>
                </>
            )}
            
            <style>{`
                @keyframes description-entry {
                    from { opacity: 0; transform: translateX(-10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-description-entry {
                    animation: description-entry 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
};

export default PhotoSlider;
