
import React, { useState, useEffect } from 'react';
import PhotoSlider from './PhotoSlider';
import PhotoGallery from './PhotoGallery';
import { 
    GOOGLE_SHEET_PHOTOS_URL 
} from '../config';

interface ImageData {
    url: string;
    description: string;
}

const HomePage: React.FC = () => {
    const [sliderImages, setSliderImages] = useState<ImageData[]>([]);
    const [galleryImages, setGalleryImages] = useState<ImageData[]>([]);
    const [loading, setLoading] = useState(true);
    const [diagnosticInfo, setDiagnosticInfo] = useState<string | null>(null);

    const getDriveDirectUrl = (input: string) => {
        if (!input || typeof input !== 'string') return '';
        const trimmed = input.trim();
        
        if (trimmed.includes('drive.google.com') || trimmed.includes('google.com/open')) {
            const idMatch = trimmed.match(/(?:id=|\/d\/|folders\/|file\/d\/|\/u\/\d+\/d\/|open\?id=)([-\w]{25,})/);
            const id = idMatch ? idMatch[1] : '';
            return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : '';
        }

        return trimmed.startsWith('http') ? trimmed : '';
    };

    const parseCSVToObjects = (csv: string): Record<string, string>[] => {
        if (!csv) return [];
        const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return [];
        
        const parseLine = (line: string) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    result.push(current.trim().replace(/^"|"$/g, ''));
                    current = '';
                } else current += char;
            }
            result.push(current.trim().replace(/^"|"$/g, ''));
            return result;
        };

        const rawHeaders = parseLine(lines[0]);
        const headers = rawHeaders.map(h => h.trim().toUpperCase().replace(/[\s_]+/g, ''));
        
        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            const row: Record<string, string> = {};
            headers.forEach((h, i) => {
                if (h) row[h] = (vals[i] || '').trim();
            });
            return row;
        });
    };

    const getFuzzy = (row: Record<string, string>, keywords: string[]) => {
        const keys = Object.keys(row);
        // First pass: look for exact matches
        for (const keyword of keywords) {
            const upperK = keyword.toUpperCase();
            if (row[upperK] !== undefined) return row[upperK];
        }
        // Second pass: look for partial matches
        for (const keyword of keywords) {
            const upperK = keyword.toUpperCase();
            const match = keys.find(k => k.includes(upperK));
            if (match && row[match]) return row[match];
        }
        return '';
    };

    useEffect(() => {
        const fetchPhotos = async () => {
            setLoading(true);
            setDiagnosticInfo(null);
            try {
                const response = await fetch(`${GOOGLE_SHEET_PHOTOS_URL}&t=${Date.now()}`);
                if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
                
                const csvText = await response.text();
                const rows = parseCSVToObjects(csvText);

                if (rows.length === 0) {
                    setDiagnosticInfo('No data found in the spreadsheet.');
                    setLoading(false);
                    return;
                }

                const slider: ImageData[] = [];
                const gallery: ImageData[] = [];

                rows.forEach(row => {
                    const urlRaw = getFuzzy(row, ['URL', 'LINK', 'DRIVE', 'IMAGE', 'PHOTO']);
                    const typeRaw = getFuzzy(row, ['TYPE', 'CATEGORY', 'CAT', 'SEC', 'PLACEMENT']) || 'gallery';
                    const descRaw = getFuzzy(row, ['DESCRIPTION', 'DESC', 'CAPTION', 'NOTE', 'OUTCOME']) || '';
                    
                    const directUrl = getDriveDirectUrl(urlRaw);
                    if (directUrl) {
                        const imgData = { url: directUrl, description: descRaw };
                        const type = typeRaw.toLowerCase();
                        if (type.includes('slider') || type.includes('hero') || type.includes('highlight')) {
                            slider.push(imgData);
                        } else {
                            gallery.push(imgData);
                        }
                    }
                });

                setSliderImages(slider.reverse());
                setGalleryImages(gallery.reverse());
                
            } catch (err: any) {
                setDiagnosticInfo(`Connection Error: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchPhotos();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Updating Field Gallery...</p>
            </div>
        );
    }

    return (
        <div className="space-y-16">
            <section className="animate-fade-in">
                <div className="text-center mb-10 px-4">
                    <h2 className="text-4xl font-black text-gray-800 dark:text-white tracking-tight uppercase">Project Highlights</h2>
                    <div className="h-1.5 w-20 bg-indigo-600 mx-auto mt-4 rounded-full shadow-lg"></div>
                </div>
                {sliderImages.length > 0 ? (
                    <PhotoSlider images={sliderImages} />
                ) : (
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="relative overflow-hidden rounded-[2.5rem] border-4 border-dashed border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 p-16 text-center">
                            <p className="text-gray-400 font-black text-xs uppercase tracking-widest">No highlight photos found.</p>
                        </div>
                    </div>
                )}
            </section>
            
            <section className="animate-fade-in">
                <div className="text-center mb-10 px-4">
                    <h2 className="text-4xl font-black text-gray-800 dark:text-white tracking-tight uppercase">Field Documentation</h2>
                    <div className="h-1.5 w-20 bg-emerald-600 mx-auto mt-4 rounded-full"></div>
                </div>
                {galleryImages.length > 0 ? (
                    <PhotoGallery images={galleryImages} />
                ) : (
                    <div className="mx-4 p-16 bg-gray-50/50 dark:bg-gray-900/30 rounded-[2.5rem] border-4 border-dashed border-gray-100 dark:border-gray-800 text-center">
                        <p className="text-gray-400 italic text-xs font-black uppercase tracking-widest">Gallery Empty</p>
                        {diagnosticInfo && (
                            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl inline-block border border-red-100 dark:border-red-900/30">
                                <p className="text-[10px] text-red-500 font-mono uppercase tracking-widest">
                                    {diagnosticInfo}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

export default HomePage;
