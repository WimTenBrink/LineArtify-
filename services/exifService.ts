
// @ts-ignore
import piexif from 'piexifjs';

export interface ExifMetadata {
    filename: string;
    style: string;
    model: string;
}

// Helper to convert data URL to base64 string (strip prefix)
const stripDataPrefix = (dataUrl: string): string => {
    return dataUrl.split(',')[1];
};

export const addExifToJpeg = (jpegDataUrl: string, metadata: ExifMetadata): string => {
    try {
        const jpegBase64 = stripDataPrefix(jpegDataUrl);
        
        const zeroth: any = {};
        const exif: any = {};
        const gps: any = {};

        const currentYear = new Date().getFullYear().toString();
        const currentDateTime = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''); // "YYYY-MM-DD HH:MM:SS" format approximation

        // 0th IFD Tags
        zeroth[piexif.ImageIFD.Make] = "Google Gemini";
        zeroth[piexif.ImageIFD.Model] = metadata.model;
        zeroth[piexif.ImageIFD.Software] = `LineArtify AI (${metadata.model})`;
        zeroth[piexif.ImageIFD.Artist] = "Katje B.V.";
        zeroth[piexif.ImageIFD.Copyright] = `Knowledge And Technology Joyfully Engaged ${currentYear}`;
        zeroth[piexif.ImageIFD.ImageDescription] = `${metadata.filename} - ${metadata.style}`;
        zeroth[piexif.ImageIFD.DateTime] = currentDateTime;

        // GPS IFD Tags (Amsterdam)
        // Latitude: 52.3676 => 52 deg 22' 3.36" N
        // Longitude: 4.9041 => 4 deg 54' 14.76" E
        
        gps[piexif.GPSIFD.GPSLatitudeRef] = "N";
        gps[piexif.GPSIFD.GPSLatitude] = [[52, 1], [22, 1], [336, 100]];
        gps[piexif.GPSIFD.GPSLongitudeRef] = "E";
        gps[piexif.GPSIFD.GPSLongitude] = [[4, 1], [54, 1], [1476, 100]];
        
        const exifObj = { "0th": zeroth, "Exif": exif, "GPS": gps };
        const exifBytes = piexif.dump(exifObj);

        // Insert into JPEG
        const newJpeg = piexif.insert(exifBytes, jpegDataUrl);
        return newJpeg;

    } catch (e) {
        console.error("Failed to add EXIF data", e);
        return jpegDataUrl; // Fallback to original if failure
    }
};

export const convertBlobUrlToJpeg = async (blobUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject("Canvas error"); return; }
            
            // Fill white background for transparency (JPEG doesn't support alpha)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            
            // Export as high quality JPEG
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            resolve(dataUrl);
        };
        img.onerror = () => reject("Failed to load image for conversion");
        img.src = blobUrl;
    });
};
