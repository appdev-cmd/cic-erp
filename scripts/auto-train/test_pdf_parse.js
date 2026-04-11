import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function test() {
    try {
        const { PDFParse } = require('pdf-parse');
        console.log('PDFParse type:', typeof PDFParse);
        
        const buffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 20 >>\nstream\nBT /F1 12 Tf ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000062 00000 n \n0000000117 00000 n \n0000000212 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n282\n%%EOF');
        
        console.log('Trying new PDFParse().parse(buffer)...');
        const instance = new PDFParse();
        const res = await instance.parse(buffer);
        console.log('Success! Text length:', res.text.length);
        process.exit(0);
    } catch (e) {
        console.error('Failed:', e);
        process.exit(1);
    }
}
test();
