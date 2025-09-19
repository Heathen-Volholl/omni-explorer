import React from 'react';
import { CloudServiceIcon } from './Icons';
import type { CloudService } from '../types';

interface BreadcrumbsProps {
  path: string;
  onNavigate: (path: string) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ path, onNavigate }) => {
  const protocolMatch = path.match(/^([a-z]+):\/\//);
  if (!protocolMatch) return null;

  const service = protocolMatch[1] as CloudService;
  const rootPath = `${service}://`;
  const pathString = path.substring(rootPath.length);
  const parts = pathString.split('/').filter(Boolean);

  const getRootLabel = () => {
    switch (service) {
      case 'local':
        // Show the first part of the path as root if it's a special folder like 'Desktop' or 'This PC'
        if (parts.length > 0 && ['Desktop', 'Documents', 'Downloads', 'Music', 'Pictures', 'Videos', 'This PC'].includes(parts[0])) {
          return parts[0];
        }
        return 'Local Files';
      case 'gdrive':
        return 'Google Drive';
      case 'dropbox':
        return 'Dropbox';
      case 'onedrive':
        return 'OneDrive';
      case 'combined':
        return 'Cloud Storage';
      default:
        return service;
    }
  };

  const getRootPath = () => {
      if (service === 'local' && parts.length > 0 && ['Desktop', 'Documents', 'Downloads', 'Music', 'Pictures', 'Videos', 'This PC'].includes(parts[0])) {
          return `${rootPath}${parts[0]}/`;
      }
      return rootPath;
  }
  
  const pathSegments = getRootPath() === rootPath ? parts : parts.slice(1);

  const constructPath = (index: number) => {
    const basePath = getRootPath();
    return `${basePath}${pathSegments.slice(0, index + 1).join('/')}`;
  };

  return (
    <nav className="flex items-center text-sm text-slate-600 space-x-1.5">
      <button onClick={() => onNavigate(getRootPath())} className="flex items-center space-x-2 p-1 rounded hover:bg-slate-100">
        <CloudServiceIcon service={service as CloudService} />
        <span>{getRootLabel()}</span>
      </button>
      
      {pathSegments.length > 0 && <span>/</span>}
      
      {pathSegments.map((part, index) => (
        <React.Fragment key={index}>
          <button
            onClick={() => onNavigate(constructPath(index))}
            className="p-1 rounded hover:bg-slate-100"
            disabled={index === pathSegments.length - 1}
          >
            {part}
          </button>
          {index < pathSegments.length - 1 && <span>/</span>}
        </React.Fragment>
      ))}
    </nav>
  );
};
