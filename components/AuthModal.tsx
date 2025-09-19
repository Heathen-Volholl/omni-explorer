import React, { useState, useEffect } from 'react';
import { CloudServiceIcon } from './Icons';
// FIX: Changed type-only import to a regular import to allow using CloudService enum as a value.
import { CloudService } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  service: Exclude<CloudService, CloudService.LOCAL | CloudService.COMBINED> | null;
  onClose: () => void;
  onAuthenticate: (apiKey: string) => void;
}

const serviceDisplayNames: Record<Exclude<CloudService, CloudService.LOCAL | CloudService.COMBINED>, string> = {
  [CloudService.DROPBOX]: 'Dropbox',
  [CloudService.GDRIVE]: 'Google Drive',
  [CloudService.ONEDRIVE]: 'OneDrive',
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, service, onClose, onAuthenticate }) => {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (!isOpen) {
      // Reset API key when modal is closed
      setTimeout(() => setApiKey(''), 300);
    }
  }, [isOpen]);
  
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onAuthenticate(apiKey);
    }
  };

  if (!service) return null;

  const serviceName = serviceDisplayNames[service];

  return (
    <div 
      className={`fixed inset-0 bg-black z-50 flex items-center justify-center transition-opacity duration-300 ${isOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'}`}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-lg shadow-xl w-full max-w-md m-4 transform transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleAuth}>
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <CloudServiceIcon service={service} className="w-8 h-8 flex-shrink-0" />
              <h2 id="modal-title" className="text-xl font-semibold text-slate-800">
                Connect to {serviceName}
              </h2>
            </div>
            <p className="text-slate-600 mb-5 text-sm">
              To access your files, please provide your credentials. In a real app, this would be a secure sign-in process.
            </p>
            <div>
              <label htmlFor="api-key" className="block text-sm font-medium text-slate-700 mb-1">
                API Key or Token
              </label>
              <input
                type="password"
                id="api-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your key to connect"
                autoFocus
              />
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-4 flex justify-end space-x-3 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!apiKey.trim()}
              className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
