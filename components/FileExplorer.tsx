import React from 'react';
import type { FileItem, SortableColumn } from '../types';
import { FileList } from './FileList';
import { FilePreviewer } from './FilePreviewer';
import { Breadcrumbs } from './Breadcrumbs';
import { SearchIcon, DeleteIcon, CopyIcon, PasteIcon, RefreshIcon } from './Icons';

interface FileExplorerProps {
  paneType: 'local' | 'cloud';
  path: string;
  files: FileItem[];
  isLoading: boolean;
  selectedFiles: Set<string>;
  clipboard: { files: FileItem[]; operation: 'copy' | 'cut' } | null;
  searchQuery: string;
  sortBy: SortableColumn;
  sortDirection: 'asc' | 'desc';
  selectedFile: FileItem | null;
  selectionCount: number;
  onNavigate: (path: string) => void;
  onFileSelect: (fileId: string, ctrlKey: boolean, shiftKey: boolean) => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onDrop: (files: FileItem[]) => void;
  onSort: (column: SortableColumn) => void;
}

const ActionButton: React.FC<{ onClick: () => void, disabled?: boolean, children: React.ReactNode }> = ({ onClick, disabled, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
        {children}
    </button>
);

const SearchInput: React.FC<{ 
    query: string; 
    onChange: (q: string) => void; 
    placeholder: string; 
    disabled?: boolean;
}> = ({ query, onChange, placeholder, disabled }) => (
    <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="w-4 h-4 text-slate-400" />
        </div>
        <input
            type="text"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
        />
    </div>
);


export const FileExplorer: React.FC<FileExplorerProps> = (props) => {
  const { 
    paneType, path, files, isLoading, selectedFiles, clipboard, searchQuery,
    sortBy, sortDirection, selectedFile, selectionCount, onNavigate, onFileSelect, 
    onCopy, onPaste, onDelete, onSearchChange, onRefresh, onDrop, onSort
  } = props;
  
  const isCloudCombinedView = paneType === 'cloud' && path.startsWith('combined://');

  return (
    <div className="flex flex-col flex-grow h-full overflow-hidden bg-white">
      <header className="grid grid-cols-2 items-center gap-2 p-2 border-b border-slate-200 flex-shrink-0">
         <Breadcrumbs path={path} onNavigate={onNavigate} />
         <div className="flex items-center space-x-2 justify-end">
            <div className="flex-grow max-w-xs">
                <SearchInput 
                    query={searchQuery}
                    onChange={onSearchChange}
                    placeholder={paneType === 'local' ? 'Search local files...' : 'Search cloud...'}
                    disabled={isCloudCombinedView}
                />
            </div>
            <ActionButton onClick={onCopy} disabled={selectedFiles.size === 0}>
                <CopyIcon className="w-4 h-4"/> <span>Copy</span>
            </ActionButton>
            <ActionButton onClick={onPaste} disabled={!clipboard}>
                <PasteIcon className="w-4 h-4"/> <span>Paste</span>
            </ActionButton>
            <ActionButton onClick={onDelete} disabled={selectedFiles.size === 0}>
                <DeleteIcon className="w-4 h-4"/> <span>Delete</span>
            </ActionButton>
            <ActionButton onClick={onRefresh}>
                <RefreshIcon className="w-4 h-4"/>
            </ActionButton>
         </div>
      </header>
      <div className="flex-grow flex min-h-0">
        <div className="flex-1 overflow-y-auto">
          <FileList
            files={files}
            isLoading={isLoading}
            selectedFiles={selectedFiles}
            searchQuery={searchQuery}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onFileSelect={onFileSelect}
            onNavigate={onNavigate}
            onDrop={onDrop}
            onSort={onSort}
          />
        </div>
        <FilePreviewer 
          selectedFile={selectedFile}
          selectionCount={selectionCount}
        />
      </div>
       <footer className="p-2 border-t border-slate-200 text-sm text-slate-500 flex-shrink-0">
          {files.length} items | {selectedFiles.size} selected
      </footer>
    </div>
  );
};