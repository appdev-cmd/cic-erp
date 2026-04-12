import { describe, it, expect } from 'vitest';
import {
    formatCurrency,
    formatDate,
    formatDateShort,
    formatDateTime,
    formatDateFull,
    formatDateCompact,
    removeDiacritics,
    toSlug
} from '../../utils/formatters';

describe('Formatters Utilities', () => {
    describe('formatCurrency', () => {
        it('formats numbers into VND currency format', () => {
            const result = formatCurrency(1000000);
            expect(result.replace(/\s/g, '')).toContain('1.000.000');
            expect(result).toContain('₫');
        });
    });

    describe('formatDate', () => {
        it('formats valid date string to dd/mm/yyyy', () => {
            expect(formatDate('2026-03-01')).toBe('01/03/2026');
            expect(formatDate('2026-12-31T00:00:00.000Z')).toBe('31/12/2026');
        });

        it('returns fallback for invalid date strings', () => {
            expect(formatDate('invalid-date')).toBe('—');
        });

        it('returns fallback for null or undefined', () => {
            expect(formatDate(null)).toBe('—');
            expect(formatDate(undefined, 'N/A')).toBe('N/A');
        });
    });

    describe('formatDateShort', () => {
        it('formats valid date string to dd/mm', () => {
            expect(formatDateShort('2026-03-01')).toBe('01/03');
            expect(formatDateShort('2026-12-31T00:00:00.000Z')).toBe('31/12');
        });

        it('returns fallback for invalid date strings', () => {
            expect(formatDateShort('invalid-date')).toBe('—');
        });

        it('returns fallback for null or undefined', () => {
            expect(formatDateShort(null)).toBe('—');
            expect(formatDateShort(undefined, 'N/A')).toBe('N/A');
        });
    });

    describe('formatDateTime', () => {
        it('formats valid date string to dd/mm/yyyy HH:mm', () => {
            // Note: getTimezoneOffset behavior in vitest might affect hours/mins
            // We use a mock date to avoid timezone issues or just use local string parsing
            const date = new Date('2026-03-01T14:30:00');
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            expect(formatDateTime('2026-03-01T14:30:00')).toBe(`${day}/${month}/${year} ${hours}:${minutes}`);
        });

        it('returns fallback for invalid date strings', () => {
            expect(formatDateTime('invalid-date')).toBe('—');
        });

        it('returns fallback for null or undefined', () => {
            expect(formatDateTime(null)).toBe('—');
        });
    });

    describe('formatDateFull', () => {
        it('formats valid date string to Full Date with Weekday', () => {
            const result = formatDateFull('2026-03-01T12:00:00Z');
            // 2026-03-01 was a Sunday. In vi-VN locale, Sunday is "Chủ nhật".
            // Since tests run in different TZ, it may evaluate to another day, 
            // but its format should contain ", ".
            expect(result).toContain(', ');
            expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}$/);
        });

        it('returns fallback for invalid date strings', () => {
            expect(formatDateFull('invalid-date')).toBe('—');
        });

        it('returns fallback for null or undefined', () => {
            expect(formatDateFull(null, 'Chưa có')).toBe('Chưa có');
        });
    });

    describe('formatDateCompact', () => {
        it('formats valid date string to dd/mm/yy', () => {
            expect(formatDateCompact('2026-03-01')).toBe('01/03/26');
            expect(formatDateCompact('1999-12-31')).toBe('31/12/99');
        });

        it('returns fallback for invalid date strings', () => {
            expect(formatDateCompact('invalid-date')).toBe('—');
        });

        it('returns fallback for null or undefined', () => {
            expect(formatDateCompact(null)).toBe('—');
        });
    });

    describe('Text Normalization Utilities', () => {
        describe('removeDiacritics', () => {
            it('removes Vietnamese diacritics', () => {
                expect(removeDiacritics('Nguyễn Văn Hùng')).toBe('Nguyen Van Hung');
                expect(removeDiacritics('hợp đồng')).toBe('hop dong');
                expect(removeDiacritics('Đại Học')).toBe('Dai Hoc');
            });
        });

        describe('toSlug', () => {
            it('creates URL-friendly slugs from Vietnamese strings', () => {
                expect(toSlug('Trần Ngọc Quỳnh')).toBe('tran_ngoc_quynh');
                expect(toSlug('Công ty TNHH MTV')).toBe('cong_ty_tnhh_mtv');
                expect(toSlug('  Dự án A & B!@#  ')).toBe('du_an_a_b');
            });
        });
    });
});
