
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
        if (!trimmed.toLowerCase().includes('drive.google.com')) {
            return trimmed.startsWith('http') ? trimmed : '';
        }
        const idMatch = trimmed.match(/(?:id=|\/d\/|folders\/|file\/d\/|\/u\/\d+\/d\/|open\?id=)([-\w]{25,})/);
        const id = idMatch ? idMatch[1] : '';
        return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : '';
    };

    const parseCSV = (csv: string): Record<string, string>[] => {
        if (!csv || typeof csv !== 'string') return [];
        const cleanCsv = csv.trim();
        if (cleanCsv.toLowerCase().startsWith('<!doctype') || cleanCsv.toLowerCase().startsWith('<html')) {
            return [];
        }
        const lines = cleanCsv.split(/\r?\n/).filter(l => l.trim().length > 0);
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

        const headers = parseLine(lines[0]).map(h => h.toUpperCase().trim());
        
        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            const row: Record<string, string> = {};
            headers.forEach((h, i) => {
                if (h) row[h] = (vals[i] || '').trim();
            });
            if (!headers.includes('URL') && vals[0]) {
                row['URL'] = vals[0];
            }
            return row;
        });
    };

    useEffect(() => {
        const fetchPhotos = async () => {
            setLoading(true);
            setDiagnosticInfo(null);
            try {
                const response = await fetch(`${GOOGLE_SHEET_PHOTOS_URL}&t=${Date.now()}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const csvText = await response.text();
                const rows = parseCSV(csvText);

                if (rows.length === 0) {
                    setDiagnosticInfo(csvText.includes('<html') ? 'PUBLISHING ERROR: Published link is a web page. Use CSV format.' : 'EMPTY SHEET: No image rows found.');
                    setLoading(false);
                    return;
                }

                const slider: ImageData[] = [];
                const gallery: ImageData[] = [];

                const urlKeys = ['URL', 'LINK', 'IMAGE', 'PHOTO', 'DRIVE LINK'];
                const typeKeys = ['TYPE', 'CATEGORY', 'SECTION', 'TAG'];
                const descKeys = ['DESCRIPTION', 'NOTES', 'CAPTION', 'DESC'];

                rows.forEach(row => {
                    const urlKey = urlKeys.find(k => row[k]);
                    const url = urlKey ? row[urlKey] : row['URL'];
                    
                    const typeKey = typeKeys.find(k => row[k]);
                    const type = (typeKey ? row[typeKey] : 'gallery').toLowerCase();

                    const descKey = descKeys.find(k => row[k]);
                    const description = descKey ? row[descKey] : '';
                    
                    const directUrl = getDriveDirectUrl(url);
                    if (directUrl) {
                        const imgData = { url: directUrl, description };
                        if (type === 'slider' || type === 'highlight' || type === 'top') slider.push(imgData);
                        else gallery.push(imgData);
                    }
                });

                setSliderImages(slider);
                setGalleryImages(gallery);
                
                if (slider.length === 0 && gallery.length === 0) {
                    setDiagnosticInfo('NO VALID LINKS: Found data but no valid Google Drive or Image URLs.');
                }
            } catch (err: any) {
                setDiagnosticInfo(`NETWORK ERROR: ${err.message}`);
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
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Syncing Media...</p>
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
                    <PhotoSlider images={sliderImages.map(img => img.url)} />
                ) : (
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 p-12 text-center">
                            <p className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-4">Awaiting Highlight Photos</p>
                            {diagnosticInfo && <p className="text-red-500 text-xs font-mono">{diagnosticInfo}</p>}
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 px-4">
                        {galleryImages.map((img, index) => (
                            <div key={index} className="group relative overflow-hidden rounded-2xl shadow-md bg-gray-100 dark:bg-gray-800 aspect-square sm:aspect-video">
                                <img
                                    src={img.url}
                                    alt={img.description || `Field Doc ${index + 1}`}
                                    className="w-full h-full object-cover transform transition-all duration-700 ease-in-out group-hover:scale-110"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                    <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">Field Registry</span>
                                    {img.description && (
                                        <p className="text-white text-[11px] font-bold line-clamp-2 leading-tight">{img.description}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mx-4 p-12 bg-gray-50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
                        <p className="text-gray-400 italic text-sm">Gallery documentation empty.</p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default HomePage;
