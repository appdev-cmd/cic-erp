import fs from 'fs';
import xlsx from 'xlsx';

const files = [
    'd:\\01_Projects\\cic-erp-contract\\PAKD.xlsx',
    'd:\\01_Projects\\cic-erp-contract\\PAKD_DCS.xlsx',
    'd:\\01_Projects\\cic-erp-contract\\PAKD mẫu của Chi nhánh.xlsx'
];

files.forEach(file => {
    console.log('\n=======================================');
    console.log('📄 FILE:', file);
    console.log('=======================================');
    try {
        const workbook = xlsx.readFile(file);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        // We want a 2D array representing rows and columns to visually inspect the structure
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });

        // Filter out completely empty rows for concise logging, up to a limit
        const non_empty = data.filter(row => row.some(cell => cell !== null && cell !== ''));
        console.log(JSON.stringify(non_empty.slice(0, 40), null, 2));
    } catch (e) {
        console.error('Error reading', file, e.message);
    }
});
