const fs = require('fs');
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
    ShadingType, PageNumber, LevelFormat
} = require('docx');

const CIC_BLUE = '1B4F72';
const CIC_LIGHT = 'D6EAF8';
const CIC_ACCENT = '2E86C1';
const GRAY_DARK = '2C3E50';
const GRAY_LIGHT = 'F2F3F4';
const WHITE = 'FFFFFF';
const BORDER_COLOR = 'BDC3C7';

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const FULL_WIDTH = 9026;

function richPara(runs, opts = {}) {
    return new Paragraph({
        spacing: { before: opts.spaceBefore || 0, after: opts.spaceAfter || 120 },
        alignment: opts.align || AlignmentType.LEFT,
        children: runs.map(r => new TextRun({
            text: r.text, font: r.font || 'Arial', size: r.size || 22,
            bold: r.bold || false, italics: r.italics || false, color: r.color || GRAY_DARK,
        }))
    });
}

function para(text, opts = {}) {
    return richPara([{ text, bold: opts.bold, color: opts.color, size: opts.size, font: opts.font, italics: opts.italics }], opts);
}

function headerCell(text, width) {
    return new TableCell({
        borders, width: { size: width, type: WidthType.DXA },
        shading: { fill: CIC_BLUE, type: ShadingType.CLEAR }, margins: cellMargins,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: WHITE, font: 'Arial', size: 22 })] })]
    });
}

function bodyCell(text, width, shading) {
    return new TableCell({
        borders, width: { size: width, type: WidthType.DXA },
        shading: shading ? { fill: shading, type: ShadingType.CLEAR } : undefined, margins: cellMargins,
        children: [para(text, { spaceAfter: 0 })]
    });
}

const doc = new Document({
    styles: {
        default: { document: { run: { font: 'Arial', size: 22 } } },
        paragraphStyles: [
            {
                id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: 36, bold: true, font: 'Arial', color: CIC_BLUE },
                paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 }
            },
            {
                id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: 28, bold: true, font: 'Arial', color: CIC_ACCENT },
                paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 }
            },
        ]
    },
    numbering: {
        config: [
            { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        headers: {
            default: new Header({
                children: [new Paragraph({
                    alignment: AlignmentType.RIGHT, children: [
                        new TextRun({ text: 'CIC ERP \u2014 H\u01b0\u1edbng d\u1eabn n\u1ed9i b\u1ed9', font: 'Arial', size: 16, color: '7F8C8D', italics: true }),
                    ]
                })]
            })
        },
        footers: {
            default: new Footer({
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER, children: [
                        new TextRun({ text: 'Trang ', font: 'Arial', size: 16, color: '7F8C8D' }),
                        new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '7F8C8D' }),
                    ]
                })]
            })
        },
        children: [
            // TITLE
            new Paragraph({ spacing: { before: 600, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'H\u01af\u1edaNG D\u1eaaN \u0110\u0102NG K\u00dd', font: 'Arial', size: 40, bold: true, color: CIC_BLUE })] }),
            new Paragraph({ spacing: { before: 0, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NH\u1eacN TH\u00d4NG B\u00c1O TELEGRAM', font: 'Arial', size: 40, bold: true, color: CIC_BLUE })] }),
            new Paragraph({ spacing: { before: 200, after: 80 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'H\u1ec7 th\u1ed1ng CIC ERP Contract Management', font: 'Arial', size: 24, color: CIC_ACCENT })] }),
            new Paragraph({ spacing: { before: 0, after: 400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Ng\u00e0y: 03/03/2026  |  Phi\u00ean b\u1ea3n: 1.0', font: 'Arial', size: 20, color: '7F8C8D', italics: true })] }),

            // 1. GIỚI THIỆU
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('1. Gi\u1edbi thi\u1ec7u')] }),
            para('H\u1ec7 th\u1ed1ng CIC ERP \u0111\u00e3 t\u00edch h\u1ee3p th\u00f4ng b\u00e1o qua Telegram. Khi h\u1ee3p \u0111\u1ed3ng ho\u1eb7c thanh to\u00e1n c\u00f3 thay \u0111\u1ed5i, b\u1ea1n s\u1ebd nh\u1eadn \u0111\u01b0\u1ee3c th\u00f4ng b\u00e1o t\u1ef1 \u0111\u1ed9ng qua Telegram.'),

            // Info box
            new Table({
                width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH], rows: [new TableRow({
                    children: [new TableCell({
                        borders: { top: { style: BorderStyle.SINGLE, size: 1, color: CIC_ACCENT }, bottom: { style: BorderStyle.SINGLE, size: 1, color: CIC_ACCENT }, left: { style: BorderStyle.SINGLE, size: 6, color: CIC_ACCENT }, right: { style: BorderStyle.SINGLE, size: 1, color: CIC_ACCENT } },
                        shading: { fill: CIC_LIGHT, type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 200, right: 200 }, width: { size: FULL_WIDTH, type: WidthType.DXA },
                        children: [
                            richPara([{ text: 'C\u00e1c lo\u1ea1i th\u00f4ng b\u00e1o b\u1ea1n s\u1ebd nh\u1eadn:', bold: true, color: CIC_BLUE }], { spaceAfter: 80 }),
                            richPara([{ text: '\ud83d\udccb  H\u1ee3p \u0111\u1ed3ng m\u1edbi \u0111\u01b0\u1ee3c t\u1ea1o' }], { spaceAfter: 40 }),
                            richPara([{ text: '\u270f\ufe0f  H\u1ee3p \u0111\u1ed3ng \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt / chuy\u1ec3n tr\u1ea1ng th\u00e1i' }], { spaceAfter: 40 }),
                            richPara([{ text: '\ud83d\udcb0  Thanh to\u00e1n m\u1edbi / c\u1eadp nh\u1eadt thanh to\u00e1n' }], { spaceAfter: 40 }),
                            richPara([{ text: '\u274c  H\u1ee3p \u0111\u1ed3ng ho\u1eb7c thanh to\u00e1n b\u1ecb x\u00f3a' }], { spaceAfter: 0 }),
                        ]
                    })]
                })]
            }),

            // 2. YÊU CẦU
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('2. Y\u00eau c\u1ea7u')] }),
            new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: '\u0110i\u1ec7n tho\u1ea1i ho\u1eb7c m\u00e1y t\u00ednh c\u00f3 c\u00e0i Telegram', font: 'Arial', size: 22 })] }),
            new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: 'T\u00e0i kho\u1ea3n Telegram \u0111ang ho\u1ea1t \u0111\u1ed9ng', font: 'Arial', size: 22 })] }),
            new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: 'Th\u1eddi gian th\u1ef1c hi\u1ec7n: kho\u1ea3ng 2 ph\u00fat', font: 'Arial', size: 22 })] }),

            // 3. HƯỚNG DẪN
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('3. H\u01b0\u1edbng d\u1eabn t\u1eebng b\u01b0\u1edbc')] }),

            // Bước 1
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('B\u01b0\u1edbc 1: T\u00ecm Bot CIC AI tr\u00ean Telegram')] }),
            para('1. M\u1edf \u1ee9ng d\u1ee5ng Telegram tr\u00ean \u0111i\u1ec7n tho\u1ea1i ho\u1eb7c m\u00e1y t\u00ednh.'),
            richPara([{ text: '2. Nh\u1ea5n v\u00e0o \u00f4 ' }, { text: 'T\u00ecm ki\u1ebfm (Search)', bold: true }, { text: ' \u1edf ph\u00eda tr\u00ean.' }]),
            richPara([{ text: '3. G\u00f5 ' }, { text: '@CIC_AI_BOT', bold: true, color: CIC_ACCENT }, { text: ' r\u1ed3i ch\u1ecdn bot c\u00f3 t\u00ean "CIC-AI".' }], { spaceAfter: 200 }),

            // Bước 2
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('B\u01b0\u1edbc 2: G\u1eedi l\u1ec7nh /start')] }),
            richPara([{ text: 'Sau khi m\u1edf chat v\u1edbi CIC-AI Bot, nh\u1ea5n n\u00fat ' }, { text: 'START', bold: true }, { text: ' ho\u1eb7c g\u00f5:' }], { spaceAfter: 120 }),
            new Table({
                width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH], rows: [new TableRow({
                    children: [new TableCell({
                        borders, shading: { fill: GRAY_LIGHT, type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 300, right: 300 }, width: { size: FULL_WIDTH, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '/start', font: 'Consolas', size: 28, bold: true, color: CIC_BLUE })] })]
                    })]
                })]
            }),
            para('G\u1eedi tin nh\u1eafn n\u00e0y cho bot.', { spaceAfter: 200, spaceBefore: 120 }),

            // Bước 3
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('B\u01b0\u1edbc 3: L\u1ea5y m\u00e3 Chat ID')] }),
            richPara([{ text: 'Sau khi g\u1eedi /start, b\u1ea1n c\u1ea7n l\u1ea5y ' }, { text: 'Chat ID', bold: true, color: CIC_ACCENT }, { text: ' \u2014 m\u00e3 s\u1ed1 \u0111\u1ecbnh danh Telegram c\u1ee7a b\u1ea1n.' }]),
            richPara([{ text: 'C\u00e1ch l\u1ea5y:', bold: true }], { spaceAfter: 80 }),
            para('1. Truy c\u1eadp link sau tr\u00ean tr\u00ecnh duy\u1ec7t:'),

            // URL box
            new Table({
                width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH], rows: [new TableRow({
                    children: [new TableCell({
                        borders, shading: { fill: GRAY_LIGHT, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 200, right: 200 }, width: { size: FULL_WIDTH, type: WidthType.DXA },
                        children: [new Paragraph({ children: [new TextRun({ text: 'https://api.telegram.org/bot8560827758:AAGyDJ37d5mjmhDptq0u4bMAV5frwjWKDz4/getUpdates', font: 'Consolas', size: 18, color: CIC_ACCENT })] })]
                    })]
                })]
            }),

            richPara([{ text: '2. T\u00ecm d\u00f2ng  ' }, { text: '"chat":{"id": XXXXXXXXXX}', font: 'Consolas', size: 20, bold: true, color: CIC_BLUE }], { spaceBefore: 120 }),
            richPara([{ text: '3. D\u00e3y s\u1ed1 XXXXXXXXXX ch\u00ednh l\u00e0 ' }, { text: 'Chat ID', bold: true, color: CIC_ACCENT }, { text: ' c\u1ee7a b\u1ea1n.' }]),
            para('4. Ghi l\u1ea1i s\u1ed1 Chat ID n\u00e0y.', { spaceAfter: 120 }),

            // Example
            new Table({
                width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH], rows: [new TableRow({
                    children: [new TableCell({
                        borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '27AE60' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '27AE60' }, left: { style: BorderStyle.SINGLE, size: 6, color: '27AE60' }, right: { style: BorderStyle.SINGLE, size: 1, color: '27AE60' } },
                        shading: { fill: 'E8F8F5', type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 200, right: 200 }, width: { size: FULL_WIDTH, type: WidthType.DXA },
                        children: [
                            richPara([{ text: '\ud83d\udca1 V\u00ed d\u1ee5:', bold: true, color: '27AE60' }], { spaceAfter: 80 }),
                            richPara([{ text: '"chat":{"id":', font: 'Consolas', size: 20 }, { text: '5156059305', font: 'Consolas', size: 20, bold: true, color: CIC_ACCENT }, { text: ',"first_name":"Nguy\u1ec5n V\u0103n A"}', font: 'Consolas', size: 20 }]),
                            richPara([{ text: '\u2192 Chat ID c\u1ee7a b\u1ea1n l\u00e0: ' }, { text: '5156059305', bold: true, color: CIC_ACCENT }]),
                        ]
                    })]
                })]
            }),

            // Bước 4
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('B\u01b0\u1edbc 4: Nh\u1eadp Chat ID v\u00e0o CIC ERP')] }),
            para('T\u1ef1 nh\u1eadp Chat ID v\u00e0o h\u1ed3 s\u01a1 c\u1ee7a b\u1ea1n tr\u00ean h\u1ec7 th\u1ed1ng CIC ERP:', { spaceAfter: 120 }),

            richPara([{ text: '1. Truy c\u1eadp h\u1ec7 th\u1ed1ng CIC ERP v\u00e0 \u0111\u0103ng nh\u1eadp t\u00e0i kho\u1ea3n c\u1ee7a b\u1ea1n.' }]),
            richPara([{ text: '2. V\u00e0o m\u1ee5c ' }, { text: 'Nh\u00e2n s\u1ef1', bold: true, color: CIC_ACCENT }, { text: ' (menu b\u00ean tr\u00e1i).' }]),
            richPara([{ text: '3. T\u00ecm t\u00ean c\u1ee7a b\u1ea1n trong danh s\u00e1ch \u2192 nh\u1ea5n ' }, { text: 'Ch\u1ec9nh s\u1eeda', bold: true }, { text: ' (bi\u1ec3u t\u01b0\u1ee3ng b\u00fat ch\u00ec).' }]),
            richPara([{ text: '4. T\u00ecm tr\u01b0\u1eddng ' }, { text: 'Telegram', bold: true, color: CIC_ACCENT }, { text: ' \u2192 d\u00e1n d\u00e3y s\u1ed1 Chat ID v\u00e0o.' }]),
            richPara([{ text: '5. Nh\u1ea5n ' }, { text: 'L\u01b0u', bold: true }, { text: ' \u0111\u1ec3 ho\u00e0n t\u1ea5t.' }], { spaceAfter: 120 }),

            // Success box
            new Table({
                width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH], rows: [new TableRow({
                    children: [new TableCell({
                        borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '27AE60' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '27AE60' }, left: { style: BorderStyle.SINGLE, size: 6, color: '27AE60' }, right: { style: BorderStyle.SINGLE, size: 1, color: '27AE60' } },
                        shading: { fill: 'E8F8F5', type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 200, right: 200 }, width: { size: FULL_WIDTH, type: WidthType.DXA },
                        children: [
                            richPara([{ text: '\u2705 Sau khi l\u01b0u th\u00e0nh c\u00f4ng, b\u1ea1n s\u1ebd t\u1ef1 \u0111\u1ed9ng nh\u1eadn th\u00f4ng b\u00e1o qua Telegram khi c\u00f3 thay \u0111\u1ed5i h\u1ee3p \u0111\u1ed3ng/thanh to\u00e1n li\u00ean quan \u0111\u1ebfn b\u1ea1n.', bold: true, color: '27AE60', size: 20 }], { spaceAfter: 0 }),
                        ]
                    })]
                })]
            }),

            // 4. LƯU Ý
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('4. L\u01b0u \u00fd quan tr\u1ecdng')] }),
            new Table({
                width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH], rows: [new TableRow({
                    children: [new TableCell({
                        borders: { top: { style: BorderStyle.SINGLE, size: 1, color: 'E74C3C' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E74C3C' }, left: { style: BorderStyle.SINGLE, size: 6, color: 'E74C3C' }, right: { style: BorderStyle.SINGLE, size: 1, color: 'E74C3C' } },
                        shading: { fill: 'FDEDEC', type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 200, right: 200 }, width: { size: FULL_WIDTH, type: WidthType.DXA },
                        children: [
                            richPara([{ text: '\u26a0\ufe0f L\u01b0u \u00fd:', bold: true, color: 'E74C3C' }], { spaceAfter: 80 }),
                            richPara([{ text: '1. Chat ID l\u00e0 d\u00e3y s\u1ed1, KH\u00d4NG ph\u1ea3i t\u00ean ng\u01b0\u1eddi d\u00f9ng.', size: 20 }], { spaceAfter: 60 }),
                            richPara([{ text: '2. PH\u1ea2I g\u1eedi /start cho bot tr\u01b0\u1edbc khi nh\u1eadn \u0111\u01b0\u1ee3c th\u00f4ng b\u00e1o.', size: 20 }], { spaceAfter: 60 }),
                            richPara([{ text: '3. N\u1ebfu ch\u1eb7n (block) bot s\u1ebd kh\u00f4ng nh\u1eadn \u0111\u01b0\u1ee3c TB.', size: 20 }], { spaceAfter: 60 }),
                            richPara([{ text: '4. Ch\u1ec9 c\u1ea7n l\u00e0m 1 l\u1ea7n duy nh\u1ea5t \u2014 Chat ID kh\u00f4ng \u0111\u1ed5i.', size: 20 }], { spaceAfter: 0 }),
                        ]
                    })]
                })]
            }),

            // 5. HỖ TRỢ
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('5. C\u1ea7n h\u1ed7 tr\u1ee3?')] }),
            para('Li\u00ean h\u1ec7 Qu\u1ea3n tr\u1ecb vi\u00ean CIC ERP ho\u1eb7c Ph\u00f2ng CNTT.'),
            para('', { spaceAfter: 400 }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '\u2014 H\u1ebft \u2014', font: 'Arial', size: 20, color: '7F8C8D', italics: true })] }),
        ]
    }]
});

const outputPath = require('path').join('d:', 'QuocAnh', '2026', '01.Project', 'cic-erp-contract', 'docs', 'Huong-dan-dang-ky-Telegram-v2.docx');
const dir = require('path').dirname(outputPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(outputPath, buffer);
    console.log('Done: ' + outputPath);
    console.log('Size: ' + (buffer.length / 1024).toFixed(1) + ' KB');
}).catch(err => { console.error('Error:', err); process.exit(1); });
