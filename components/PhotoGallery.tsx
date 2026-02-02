
import React, { useState } from 'react';

interface PhotoGalleryProps {
    images: string[];
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ images }) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 px-4">
            {images.map((image, index) => (
                <GalleryItem key={index} src={image} index={index} />
            ))}
        </div>
    );
};

const GalleryItem: React.FC<{ src: string; index: number }> = ({ src, index }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div className="group relative overflow-hidden rounded-2xl shadow-md bg-gray-100 dark:bg-gray-800 aspect-square sm:aspect-video">
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
            )}
            <img
                src={src}
                alt={`Field Doc ${index + 1}`}
                onLoad={() => setIsLoaded(true)}
                className={`w-full h-full object-cover transform transition-all duration-700 ease-in-out group-hover:scale-110 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <span className="text-[10px] text-white font-bold uppercase tracking-widest">View Photo</span>
            </div>
        </div>
    );
};

export default PhotoGallery;
