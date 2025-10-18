
import React from 'react';
import PhotoSlider from './PhotoSlider';
import PhotoGallery from './PhotoGallery';

const HomePage: React.FC = () => {
    // Replace these with your Google Drive image links
    // Format: https://drive.google.com/uc?id=FILE_ID
    const sliderImages = [
        'https://picsum.photos/id/1018/1200/500',
        'https://picsum.photos/id/1015/1200/500',
        'https://picsum.photos/id/1019/1200/500',
        'https://picsum.photos/id/1025/1200/500',
    ];

    const galleryImages = [
        'https://picsum.photos/id/237/500/300',
        'https://picsum.photos/id/238/500/300',
        'https://picsum.photos/id/239/500/300',
        'https://picsum.photos/id/240/500/300',
        'https://picsum.photos/id/241/500/300',
        'https://picsum.photos/id/242/500/300',
        'https://picsum.photos/id/243/500/300',
        'https://picsum.photos/id/244/500/300',
    ];

    return (
        <div className="space-y-12">
            <section>
                <h2 className="text-3xl font-bold mb-6 text-center text-gray-700 dark:text-gray-300">Project Highlights</h2>
                <PhotoSlider images={sliderImages} />
            </section>
            
            <section>
                <h2 className="text-3xl font-bold mb-6 text-center text-gray-700 dark:text-gray-300">Field Gallery</h2>
                <PhotoGallery images={galleryImages} />
            </section>
        </div>
    );
};

export default HomePage;
