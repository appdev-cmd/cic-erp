import { PAKDRecord } from '../types';

const STORAGE_KEY = 'cic_erp_pakd_data';

export const PAKDService = {
    getAll: async (): Promise<PAKDRecord[]> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const data = localStorage.getItem(STORAGE_KEY);
                if (data) {
                    resolve(JSON.parse(data));
                } else {
                    resolve([]);
                }
            }, 500); // Giả lập độ trễ mạng
        });
    },

    getById: async (id: string): Promise<PAKDRecord | null> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const data = localStorage.getItem(STORAGE_KEY);
                if (data) {
                    const records: PAKDRecord[] = JSON.parse(data);
                    const found = records.find(r => r.id === id);
                    resolve(found || null);
                } else {
                    resolve(null);
                }
            }, 300);
        });
    },

    save: async (record: PAKDRecord): Promise<PAKDRecord> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const data = localStorage.getItem(STORAGE_KEY);
                let records: PAKDRecord[] = data ? JSON.parse(data) : [];

                const index = records.findIndex(r => r.id === record.id);
                const now = new Date().toISOString();

                let savedRecord: PAKDRecord;
                if (index >= 0) {
                    // Update
                    savedRecord = { ...record, updatedAt: now, createdAt: records[index].createdAt };
                    records[index] = savedRecord;
                } else {
                    // Validate required fields for new
                    if (!record.code) {
                        const randomCode = `PAKD-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
                        record.code = randomCode;
                    }
                    // Create
                    savedRecord = { ...record, createdAt: now, updatedAt: now };
                    records.unshift(savedRecord); // Add to beginning
                }

                localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
                resolve(savedRecord);
            }, 400);
        });
    },

    delete: async (id: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const data = localStorage.getItem(STORAGE_KEY);
                if (data) {
                    const records: PAKDRecord[] = JSON.parse(data);
                    const filtered = records.filter(r => r.id !== id);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
                    resolve(true);
                } else {
                    resolve(false);
                }
            }, 300);
        });
    }
};
