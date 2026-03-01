import React, { useState } from 'react';
import PAKDList from './PAKDList';
import PAKDGenerator from './PAKDGenerator';
import { PAKDRecord } from '../../types';

type ViewMode = 'list' | 'create' | 'edit';

const PAKDManager: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [editingRecord, setEditingRecord] = useState<PAKDRecord | undefined>(undefined);

    const handleCreateNew = () => {
        setEditingRecord(undefined);
        setViewMode('create');
    };

    const handleEdit = (record: PAKDRecord) => {
        setEditingRecord(record);
        setViewMode('edit');
    };

    const handleCancel = () => {
        setViewMode('list');
        setEditingRecord(undefined);
    };

    const handleSaveSubmit = () => {
        setViewMode('list');
        setEditingRecord(undefined);
    };

    return (
        <div className="h-full">
            {viewMode === 'list' && (
                <PAKDList
                    onCreateNew={handleCreateNew}
                    onEdit={handleEdit}
                />
            )}

            {(viewMode === 'create' || viewMode === 'edit') && (
                <PAKDGenerator
                    initialData={editingRecord}
                    onSave={handleSaveSubmit}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
};

export default PAKDManager;
