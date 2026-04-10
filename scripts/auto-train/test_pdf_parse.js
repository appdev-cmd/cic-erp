import { createRequire } from 'module';
const require = createRequire(import.meta.url);
try {
    const pdfParse = require('pdf-parse');
    console.log('pdfParse type:', typeof pdfParse);
    console.log('pdfParse keys:', Object.keys(pdfParse));
    const pdf = pdfParse.default || pdfParse;
    console.log('pdf type:', typeof pdf);
} catch (e) {
    console.error(e);
}
