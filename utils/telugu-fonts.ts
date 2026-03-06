
/**
 * Utility to fetch Noto Sans Telugu and Roboto fonts from the local project directory 
 * and return them in a format suitable for pdfMake VFS.
 */
export const getFontsVfs = async () => {
    try {
        const fontFiles = [
            'NotoSansTelugu-Regular.ttf',
            'Roboto-Regular.ttf',
            'Roboto-Medium.ttf',
            'Roboto-Italic.ttf'
        ];
        
        const vfs: Record<string, string> = {};
        
        for (const fileName of fontFiles) {
            const fontUrl = `${window.location.origin}/fonts/${fileName}`;
            console.log(`📂 Loading local font from: ${fontUrl}`);
            
            const response = await fetch(fontUrl, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`Failed to fetch local font ${fileName}: ${response.status} ${response.statusText}`);
            
            const blob = await response.blob();
            console.log(`📥 Loaded local font blob ${fileName}: ${blob.size} bytes`);
            
            const base64 = await blobToBase64(blob);
            let base64Data = base64;
            if (base64.includes(',')) {
                base64Data = base64.split(',')[1];
            }
            
            if (!base64Data || base64Data.length < 100) {
                throw new Error(`Base64 data for ${fileName} is too short or empty (${base64Data?.length || 0} chars)`);
            }
            
            vfs[fileName] = base64Data;
        }

        console.log('✅ All fonts converted to Base64 successfully');
        return vfs;
    } catch (error) {
        console.error('❌ Error loading local fonts:', error);
        return {};
    }
};

/**
 * Helper to convert Blob to Base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('FileReader result is not a string'));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}
