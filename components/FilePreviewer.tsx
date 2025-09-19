import React from 'react';
import type { FileItem } from '../types';
import { FileTypeIcon } from './Icons';

interface FilePreviewerProps {
  selectedFile: FileItem | null;
  selectionCount: number;
}

const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (date: Date) => {
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="py-2">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-800 break-words">{value}</p>
    </div>
);

export const FilePreviewer: React.FC<FilePreviewerProps> = ({ selectedFile, selectionCount }) => {
    
    const renderContent = () => {
        if (selectedFile) {
            const isImage = selectedFile.type === 'image';

            // A simple way to generate a consistent placeholder image URL
            const getImageUrl = (fileId: string) => {
                // Use a more specific image for the demo file
                if (fileId === 'o5') return `https://picsum.photos/seed/hawaiisunset/300/200`;
                return `https://picsum.photos/seed/${fileId}/300/200`;
            };

            return (
                <div className="p-4 flex flex-col text-center">
                    {isImage ? (
                        <div className="mb-4 w-full aspect-video bg-slate-200 rounded-md overflow-hidden">
                            <img
                                src={getImageUrl(selectedFile.id)}
                                alt={`Preview of ${selectedFile.name}`}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="mb-4 flex justify-center">
                            <FileTypeIcon type={selectedFile.type} className="w-24 h-24" />
                        </div>
                    )}
                    <h2 className="text-lg font-semibold text-slate-800 break-all mb-4">{selectedFile.name}</h2>
                    <div className="w-full text-left border-t border-slate-200">
                        <DetailRow label="Type" value={selectedFile.type.charAt(0).toUpperCase() + selectedFile.type.slice(1)} />
                        <DetailRow label="Size" value={formatBytes(selectedFile.size)} />
                        <DetailRow label="Date Modified" value={formatDate(selectedFile.modified)} />
                        <DetailRow label="Path" value={selectedFile.path} />
                    </div>
                </div>
            );
        }

        if (selectionCount > 1) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <p className="text-2xl font-bold text-slate-700">{selectionCount}</p>
                    <p className="text-slate-500">items selected</p>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="font-semibold text-slate-600">Select a file to preview</p>
                <p className="text-sm text-slate-400">Details will be shown here.</p>
            </div>
        );
    };

    return (
        <aside className="w-96 flex-shrink-0 bg-slate-50 border-l border-slate-200 overflow-y-auto">
            {renderContent()}
        </aside>
    );
};