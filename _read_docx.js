const fs = require('fs');
const zlib = require('zlib');

function readDocx(filePath) {
    const buffer = fs.readFileSync(filePath);
    let offset = 0;
    while (offset < buffer.length) {
        const signature = buffer.readUInt32LE(offset);
        if (signature === 0x04034b50) { // Local file header
            const fileNameLength = buffer.readUInt16LE(offset + 26);
            const extraFieldLength = buffer.readUInt16LE(offset + 28);
            const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLength);

            const compressedSize = buffer.readUInt32LE(offset + 18);
            const dataOffset = offset + 30 + fileNameLength + extraFieldLength;

            if (fileName === 'word/document.xml') {
                const compressedData = buffer.slice(dataOffset, dataOffset + compressedSize);
                try {
                    const xml = zlib.inflateRawSync(compressedData).toString('utf8');
                    // Very simple XML strip
                    const text = xml.replace(/<w:p[^>]*>/g, '\n').replace(/<[^>]+>/g, '');
                    console.log(text);
                } catch (e) {
                    console.error("Error inflating document.xml:", e.message);
                }
                return;
            }
            // Skip to next record (very approximate, depends on compressed data size)
            // Actually, parsing zip exactly requires finding Central Directory. 
            // Let's use a simpler approach: finding 'word/document.xml' manually if the above fails.
            offset += 30 + fileNameLength + extraFieldLength + compressedSize;
        } else if (signature === 0x08074b50) { // Data descriptor
            offset += 16;
        } else {
            // Unrecognized signature or end of central directory
            break;
        }
    }
}

// Fallback search approach if strict parsing fails
function readDocxFallback(filePath) {
    const buffer = fs.readFileSync(filePath);
    for (let i = 0; i < buffer.length - 17; i++) {
        if (buffer.toString('utf8', i, i + 17) === 'word/document.xml') {
            const extraFieldLengthIndex = i - 2;
            const extraFieldLength = buffer.readUInt16LE(extraFieldLengthIndex);

            const compressedSizeIndex = i - 12;
            const compressedSize = buffer.readUInt32LE(compressedSizeIndex);

            const dataOffset = i + 17 + extraFieldLength;
            const compressedData = buffer.slice(dataOffset, dataOffset + compressedSize);

            try {
                const xml = zlib.inflateRawSync(compressedData).toString('utf8');
                const text = xml.replace(/<w:p[^>]*>/g, '\n').replace(/<[^>]+>/g, '');
                console.log(text);
            } catch (e) {
                console.error("Fallback error:", e.message);
            }
            return;
        }
    }
}

try {
    readDocxFallback(process.argv[2]);
} catch (e) {
    console.error(e);
}
