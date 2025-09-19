import React, { useState, useEffect, useMemo } from 'react';
import type { FileItem, FileType, StorageAnalysisData } from '../types';
import { fileTypeColors } from '../types';
import { getRecursiveFolderContents } from '../services/fileService';
import { CloseIcon, AnalyticsIcon, FileTypeIcon } from './Icons';

interface StorageAnalysisModalProps {
  isOpen: boolean;
  path: string;
  folderName: string;
  onClose: () => void;
}

const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const processFiles = (items: FileItem[]): StorageAnalysisData => {
    let totalSize = 0;
    let fileCount = 0;
    let folderCount = 0;
    const typeBreakdown: Record<string, { size: number; color: string, count: number }> = {};
    const allFiles: FileItem[] = [];

    items.forEach(item => {
        if (item.type === 'folder') {
            folderCount++;
        } else {
            fileCount++;
            const size = item.size || 0;
            totalSize += size;
            allFiles.push(item);

            const typeKey = ['document', 'spreadsheet', 'presentation'].includes(item.type) ? 'document' : item.type;
            const color = fileTypeColors[typeKey as FileType] || fileTypeColors.other;

            if (!typeBreakdown[typeKey]) {
                typeBreakdown[typeKey] = { size: 0, color, count: 0 };
            }
            typeBreakdown[typeKey].size += size;
            typeBreakdown[typeKey].count++;
        }
    });
    
    const largestFiles = allFiles.sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 5);
    
    return { totalSize, fileCount, folderCount, typeBreakdown, largestFiles };
};


const DonutChart: React.FC<{ data: StorageAnalysisData['typeBreakdown'], total: number }> = ({ data, total }) => {
    const segments = useMemo(() => {
        let cumulativePercent = 0;
        return Object.entries(data)
            .sort(([, a], [, b]) => b.size - a.size)
            .map(([type, { size, color }]) => {
                const percent = total > 0 ? (size / total) * 100 : 0;
                const segment = {
                    type,
                    color,
                    percent,
                    start: cumulativePercent,
                    end: cumulativePercent + percent,
                };
                cumulativePercent += percent;
                return segment;
            });
    }, [data, total]);

    const gradient = segments.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ');

    return (
        <div className="flex items-center space-x-6">
            <div 
                className="w-32 h-32 rounded-full flex-shrink-0"
                style={{ background: `conic-gradient(${gradient})` }}
                role="img"
                aria-label="Storage usage by file type chart"
            />
            <ul className="text-sm space-y-1.5" aria-label="Chart legend">
                {segments.map(s => (
                    <li key={s.type} className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                        <span className="text-slate-600 capitalize">{s.type}</span>
                        <span className="font-medium text-slate-800">{s.percent.toFixed(1)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};


export const StorageAnalysisModal: React.FC<StorageAnalysisModalProps> = ({ isOpen, path, folderName, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState<StorageAnalysisData | null>(null);

  useEffect(() => {
    if (isOpen && path) {
      setIsLoading(true);
      setAnalysisData(null);
      getRecursiveFolderContents(path)
        .then(files => {
          setAnalysisData(processFiles(files));
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, path]);
  
  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-4 text-slate-600">Analyzing folder contents...</p>
            </div>
        );
    }

    if (!analysisData || (analysisData.fileCount === 0 && analysisData.folderCount === 0)) {
        return <div className="p-8 text-center text-slate-500">This folder is empty.</div>;
    }

    const { totalSize, fileCount, folderCount, typeBreakdown, largestFiles } = analysisData;

    return (
      <>
        <div className="grid grid-cols-3 gap-4 text-center border-b border-slate-200 pb-4 mb-4">
            <div>
                <p className="text-xs text-slate-500 uppercase">Total Size</p>
                <p className="text-xl font-bold text-blue-600">{formatBytes(totalSize)}</p>
            </div>
            <div>
                <p className="text-xs text-slate-500 uppercase">Files</p>
                <p className="text-xl font-bold text-slate-800">{fileCount.toLocaleString()}</p>
            </div>
            <div>
                <p className="text-xs text-slate-500 uppercase">Folders</p>
                <p className="text-xl font-bold text-slate-800">{folderCount.toLocaleString()}</p>
            </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
            <div>
                <h3 className="font-semibold text-slate-800 mb-3">Breakdown by Type</h3>
                {totalSize > 0 ? <DonutChart data={typeBreakdown} total={totalSize} /> : <p className="text-sm text-slate-500">No files with size found.</p>}
            </div>
            <div>
                <h3 className="font-semibold text-slate-800 mb-3">Largest Files</h3>
                {largestFiles.length > 0 ? (
                    <ul className="space-y-2">
                        {largestFiles.map(file => (
                            <li key={file.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center space-x-2 truncate">
                                    <FileTypeIcon type={file.type} className="w-4 h-4 flex-shrink-0" />
                                    <span className="text-slate-700 truncate" title={file.name}>{file.name}</span>
                                </div>
                                <span className="font-medium text-slate-800 flex-shrink-0 pl-2">{formatBytes(file.size || 0)}</span>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-sm text-slate-500">No files found.</p>}
            </div>
        </div>
      </>
    );
  };

  return (
    <div 
      className={`fixed inset-0 bg-black z-50 flex items-center justify-center transition-opacity duration-300 ${isOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'}`}
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <div 
        className={`bg-white rounded-lg shadow-xl w-full max-w-2xl m-4 transform transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
                <AnalyticsIcon className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-800">
                    Storage Analysis: <span className="font-bold">{folderName}</span>
                </h2>
            </div>
            <button
                onClick={onClose}
                className="p-1 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                aria-label="Close analysis panel"
            >
                <CloseIcon className="w-5 h-5" />
            </button>
        </header>
        <div className="p-6">
            {renderContent()}
        </div>
      </div>
    </div>
  );
};

