
import React, { useState, useEffect } from 'react';
import PhotoSlider from './PhotoSlider';
import PhotoGallery from './PhotoGallery';
import { 
    GOOGLE_SHEET_PHOTOS_URL, 
    PLACEHOLDER_IMAGE 
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
        
        // Handle common Google Drive sharing patterns
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
                    result.push(current.trim());
                    current = '';
                } else current += char;
            }
            result.push(current.trim().replace(/^"|"$/g, ''));
            return result;
        };

        const rawHeaders = parseLine(lines[0]);
        // Normalize headers for internal matching
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

    // Helper to find value in row by fuzzy key matching
    const getFuzzy = (row: Record<string, string>, keywords: string[]) => {
        const keys = Object.keys(row);
        for (const keyword of keywords) {
            const match = keys.find(k => k.includes(keyword.toUpperCase()));
            if (match && row[match]) return row[match];
        }
        return '';
    };

    useEffect(() => {
        const fetchPhotos = async () => {
            setLoading(true);
            setDiagnosticInfo(null);
            try {
                // IMPORTANT: Cache-busting prevents old data from appearing after upload
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
                    const typeRaw = getFuzzy(row, ['TYPE', 'CAT', 'SEC', 'PLACEMENT']) || 'gallery';
                    const descRaw = getFuzzy(row, ['DESC', 'CAPTION', 'NOTE', 'OUTCOME']) || '';
                    
                    const directUrl = getDriveDirectUrl(urlRaw);
                    if (directUrl) {
                        const imgData = { url: directUrl, description: descRaw };
                        const type = typeRaw.toLowerCase();
                        if (type.includes('slider') || type.includes('highlight')) {
                            slider.push(imgData);
                        } else {
                            gallery.push(imgData);
                        }
                    }
                });

                // Reverse to show the most recent uploads first
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
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Updating Gallery...</p>
            </div>
        );
    }

    return (
        <div className="space-y-16">
            <section className="animate-fade-in">
                <div className="text-center mb-10 px-4">
                    <h2 className="text-4xl font-black text-gray-800 dark:text-white tracking-tight">Project Highlights</h2>
                    <div className="h-1.5 w-20 bg-blue-600 mx-auto mt-4 rounded-full shadow-lg"></div>
                </div>
                {sliderImages.length > 0 ? (
                    <PhotoSlider images={sliderImages} />
                ) : (
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 p-12 text-center">
                            <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">No highlight photos found.</p>
                        </div>
                    </div>
                )}
            </section>
            
            <section className="animate-fade-in">
                <div className="text-center mb-10 px-4">
                    <h2 className="text-4xl font-black text-gray-800 dark:text-white tracking-tight">Field Documentation</h2>
                    <div className="h-1.5 w-20 bg-green-600 mx-auto mt-4 rounded-full"></div>
                </div>
                {galleryImages.length > 0 ? (
                    <PhotoGallery images={galleryImages} />
                ) : (
                    <div className="mx-4 p-12 bg-gray-50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
                        <p className="text-gray-400 italic text-sm font-bold uppercase tracking-widest">Gallery Empty</p>
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
