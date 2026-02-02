
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
        <div className="relative w-full max-w-5xl mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white dark:border-gray-800 group">
            <div className="relative h-72 sm:h-96 md:h-[550px] w-full bg-gray-200 dark:bg-gray-900 overflow-hidden">
                {images.map((img, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-all duration-1000 ease-in-out transform ${
                            index === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-110'
                        }`}
                    >
                        <img 
                            src={img.url} 
                            alt={img.description || `Field Photo ${index + 1}`} 
                            className="w-full h-full object-cover" 
                            loading="lazy" 
                        />
                        
                        {/* Dramatic Gradient Overlay for Text Readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none"></div>
                        
                        {/* Enhanced Description Overlay */}
                        {img.description && index === currentIndex && (
                            <div className="absolute bottom-12 left-0 right-0 px-6 sm:px-12 animate-description z-20">
                                <div className="max-w-2xl">
                                    <div className="bg-black/40 backdrop-blur-xl border border-white/20 p-5 sm:p-7 rounded-[2rem] shadow-2xl inline-block text-left transform transition-all">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="h-1 w-8 bg-blue-500 rounded-full"></div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Project Insight</span>
                                        </div>
                                        <p className="text-white text-lg sm:text-2xl font-black tracking-tight leading-tight drop-shadow-lg">
                                            {img.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Premium Navigation Controls */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute top-1/2 left-6 -translate-y-1/2 bg-white/10 backdrop-blur-md text-white p-4 rounded-full hover:bg-blue-600 transition-all transform hover:scale-110 active:scale-90 opacity-0 group-hover:opacity-100 z-30 border border-white/20"
                        aria-label="Previous image"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <button
                        onClick={nextSlide}
                        className="absolute top-1/2 right-6 -translate-y-1/2 bg-white/10 backdrop-blur-md text-white p-4 rounded-full hover:bg-blue-600 transition-all transform hover:scale-110 active:scale-90 opacity-0 group-hover:opacity-100 z-30 border border-white/20"
                        aria-label="Next image"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                    </button>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-2 z-30 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full">
                        {images.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentIndex(index)}
                                className={`h-1.5 rounded-full transition-all duration-500 ${
                                    currentIndex === index ? 'w-8 bg-blue-500' : 'w-2 bg-white/40'
                                }`}
                                aria-label={`Go to slide ${index + 1}`}
                            ></button>
                        ))}
                    </div>
                </>
            )}
            
            <style>{`
                @keyframes description-slide {
                    from { opacity: 0; transform: translateY(30px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-description {
                    animation: description-slide 0.8s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }
            `}</style>
        </div>
    );
};

export default PhotoSlider;
