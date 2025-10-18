
import React from 'react';

interface PhotoGalleryProps {
    images: string[];
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ images }) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((image, index) => (
                <div key={index} className="group relative overflow-hidden rounded-lg shadow-lg">
                    <img
                        src={image}
                        alt={`Gallery item ${index + 1}`}
                        className="w-full h-full object-cover aspect-video transform transition-transform duration-500 ease-in-out group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300"></div>
                </div>
            ))}
        </div>
    );
};

export default PhotoGallery;
