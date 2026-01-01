
import React from 'react';
import PhotoSlider from './PhotoSlider';
import PhotoGallery from './PhotoGallery';

const SLIDER_IMAGES = [
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1200',
    'https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=1200',
    'https://images.unsplash.com/photo-1523348830708-15d4a09cfac2?q=80&w=1200'
];

const GALLERY_IMAGES = [
    'https://images.unsplash.com/photo-1595113316349-9fa4ee24f884?q=80&w=500',
    'https://images.unsplash.com/photo-1592150621344-82d43b4da9f4?q=80&w=500',
    'https://images.unsplash.com/photo-1589923188900-85dae523342b?q=80&w=500',
    'https://images.unsplash.com/photo-1574943320219-553eb213f72d?q=80&w=500',
    'https://images.unsplash.com/photo-1505471768190-275e2ad7b3f9?q=80&w=500',
    'https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?q=80&w=500'
];

const HomePage: React.FC = () => {
    return (
        <div className="space-y-12">
            <section className="animate-fade-in">
                <div className="text-center mb-10">
                    <h2 className="text-4xl font-black text-gray-800 dark:text-gray-100 tracking-tight">Project Highlights</h2>
                    <div className="h-1.5 w-20 bg-blue-600 mx-auto mt-4 rounded-full"></div>
                </div>
                <PhotoSlider images={SLIDER_IMAGES} />
            </section>
            
            <section className="animate-fade-in">
                <div className="text-center mb-10">
                    <h2 className="text-4xl font-black text-gray-800 dark:text-gray-100 tracking-tight">Field Gallery</h2>
                    <div className="h-1.5 w-20 bg-green-600 mx-auto mt-4 rounded-full"></div>
                </div>
                <PhotoGallery images={GALLERY_IMAGES} />
            </section>
        </div>
    );
};

export default HomePage;
