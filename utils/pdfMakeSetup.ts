import pdfMake from 'pdfmake/build/pdfmake';
import { getFontsVfs } from './telugu-fonts';

/**
 * pdfMakeSetup.ts
 * Centralized configuration for pdfMake with Telugu and English font support.
 */

/**
 * Ensures the Telugu and English fonts are injected into the VFS and registers them.
 */
export const initializePdfMake = async () => {
    try {
        const fontsVfs = await getFontsVfs();
        
        // Set it on the pdfMake object
        (pdfMake as any).vfs = fontsVfs;

        // Register font configuration
        const fontConfig = {
            Roboto: {
                normal: 'Roboto-Regular.ttf',
                bold: 'Roboto-Medium.ttf',
                italics: 'Roboto-Italic.ttf',
                bolditalics: 'Roboto-Medium.ttf'
            },
            NotoSansTelugu: {
                normal: 'NotoSansTelugu-Regular.ttf',
                bold: 'NotoSansTelugu-Regular.ttf',
                italics: 'NotoSansTelugu-Regular.ttf',
                bolditalics: 'NotoSansTelugu-Regular.ttf'
            }
        };
        
        (pdfMake as any).fonts = fontConfig;
        
        // Set on window for global access (some pdfMake internals look here)
        if (typeof window !== 'undefined') {
            (window as any).pdfMake = pdfMake;
        }

        console.log('✅ PDFMake Initialized with Telugu and English support. VFS Keys:', Object.keys((pdfMake as any).vfs));
    } catch (error) {
        console.error('❌ Error initializing pdfMake:', error);
    }
    
    return pdfMake;
};

export default pdfMake;
