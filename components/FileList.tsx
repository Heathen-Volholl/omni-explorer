import React, { useState } from 'react';
import type { FileItem, SortableColumn } from '../types';
import { FileTypeIcon } from './Icons';

interface FileListProps {
  files: FileItem[];
  isLoading: boolean;
  selectedFiles: Set<string>;
  searchQuery: string;
  sortBy: SortableColumn;
  sortDirection: 'asc' | 'desc';
  onFileSelect: (fileId: string, ctrlKey: boolean, shiftKey:boolean) => void;
  onNavigate: (path: string) => void;
  onDrop: (files: FileItem[]) => void;
  onSort: (column: SortableColumn) => void;
}

const FileListItem: React.FC<{
  file: FileItem;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}> = ({ file, isSelected, onClick, onDoubleClick, onDragStart }) => {
  const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <tr
      draggable="true"
      className={`select-none border-b border-slate-100 cursor-pointer ${
        isSelected ? 'bg-blue-100' : 'hover:bg-slate-50'
      }`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onDragStart={onDragStart}
    >
      <td className="px-4 py-2.5 text-sm text-slate-800 font-medium flex items-center space-x-3">
        <FileTypeIcon type={file.type} />
        <span>{file.name}</span>
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-500">{formatDate(file.modified)}</td>
      <td className="px-4 py-2.5 text-sm text-slate-500 capitalize">{file.type}</td>
      <td className="px-4 py-2.5 text-sm text-slate-500 text-right">{formatBytes(file.size)}</td>
    </tr>
  );
};

const SortableHeader: React.FC<{
    column: SortableColumn;
    label: string;
    sortBy: SortableColumn;
    sortDirection: 'asc' | 'desc';
    onSort: (column: SortableColumn) => void;
    className?: string;
}> = ({ column, label, sortBy, sortDirection, onSort, className }) => {
    const isCurrentSort = sortBy === column;
    const sortIcon = isCurrentSort ? (sortDirection === 'asc' ? '▲' : '▼') : '';

    return (
        <th
            className={`px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100 transition-colors ${className}`}
            onClick={() => onSort(column)}
            aria-sort={isCurrentSort ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <div className={`flex items-center ${className?.includes('text-right') ? 'justify-end' : ''}`}>
                <span>{label}</span>
                {isCurrentSort && <span className="ml-1.5 text-[10px] text-slate-400">{sortIcon}</span>}
            </div>
        </th>
    );
};


export const FileList: React.FC<FileListProps> = ({ files, isLoading, selectedFiles, searchQuery, sortBy, sortDirection, onFileSelect, onNavigate, onDrop, onSort }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading files...</div>;
  }
  
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const sortedAndFilteredFiles = [...filteredFiles].sort((a, b) => {
    // Keep folders grouped at the top
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;

    let compareResult = 0;
    switch (sortBy) {
        case 'name':
            compareResult = a.name.localeCompare(b.name);
            break;
        case 'modified':
            compareResult = a.modified.getTime() - b.modified.getTime(); // asc = oldest first
            break;
        case 'type':
            compareResult = a.type.localeCompare(b.type);
            break;
        case 'size':
            // Folders have null size, treat them as smaller than any file
            const sizeA = a.size ?? -1;
            const sizeB = b.size ?? -1;
            compareResult = sizeA - sizeB;
            break;
    }

    return sortDirection === 'asc' ? compareResult : -compareResult;
  });


  const handleDragStart = (e: React.DragEvent, file: FileItem) => {
    let filesToDrag: FileItem[];
    if (selectedFiles.has(file.id)) {
      // If dragging a selected item, drag all selected items
      filesToDrag = files.filter(f => selectedFiles.has(f.id));
    } else {
      // Otherwise, drag just this one item
      filesToDrag = [file];
    }
    e.dataTransfer.setData('application/json', JSON.stringify(filesToDrag));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'copy';
  };
  
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Check if the relatedTarget is outside the dropzone to prevent flickering
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFilesJson = e.dataTransfer.getData('application/json');
    if (droppedFilesJson) {
      const droppedFiles = JSON.parse(droppedFilesJson);
      onDrop(droppedFiles);
    }
  };

  if (sortedAndFilteredFiles.length === 0 && !isDragOver) {
    if (searchQuery) {
      return <div className="p-8 text-center text-slate-500">No files match your search.</div>;
    }
    return <div className="p-8 text-center text-slate-500">This folder is empty.</div>;
  }


  return (
    <div 
        className="relative h-full"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
    >
         {isDragOver && (
            <div className="absolute inset-2 bg-blue-500 bg-opacity-10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center pointer-events-none z-20">
                <span className="text-blue-600 font-semibold text-lg">Drop files here to copy</span>
            </div>
        )}
        <table className="w-full text-left">
        <thead className="sticky top-0 bg-slate-50 z-10">
            <tr className="border-b border-slate-200">
                <SortableHeader column="name" label="Name" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader column="modified" label="Date modified" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader column="type" label="Type" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader column="size" label="Size" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} className="text-right" />
            </tr>
        </thead>
        <tbody>
            {sortedAndFilteredFiles.map((file) => (
            <FileListItem
                key={file.id}
                file={file}
                isSelected={selectedFiles.has(file.id)}
                onClick={(e) => onFileSelect(file.id, e.ctrlKey || e.metaKey, e.shiftKey)}
                onDoubleClick={() => file.type === 'folder' && onNavigate(file.path)}
                onDragStart={(e) => handleDragStart(e, file)}
            />
            ))}
        </tbody>
        </table>
    </div>
  );
};
