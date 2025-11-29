import React, { useState, useEffect, useRef } from 'react';
import { UserFile } from '../types';
import { uploadUserFile, deleteUserFile, getUserFiles } from '../services/fileService';
import { auth } from '../services/firebase';
import { FileText, UploadCloud, Trash2, Download, HardDrive, RefreshCw, AlertCircle, File, Image, Film, Music, Loader2 } from 'lucide-react';

const DocumentsPage: React.FC = () => {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = auth.currentUser;

  const fetchFiles = async () => {
    if (!currentUser) return;
    setLoading(true);
    const res = await getUserFiles(currentUser.uid);
    if (res.success && res.data) {
      setFiles(res.data);
    } else {
      setError(res.message || "Failed to load files");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (currentUser) {
      fetchFiles();
    }
  }, [currentUser]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !currentUser) return;
    
    setUploading(true);
    setError(null);
    const file = e.target.files[0];

    const res = await uploadUserFile(file, currentUser.uid);
    
    if (res.success) {
      await fetchFiles(); // Refresh list
    } else {
      setError(res.message || "Upload failed");
    }
    setUploading(false);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (file: UserFile) => {
    if (!currentUser) return;
    if (!window.confirm(`Are you sure you want to delete "${file.name}"?`)) return;

    const res = await deleteUserFile(file.id, file.storagePath, currentUser.uid);
    if (res.success) {
      setFiles(files.filter(f => f.id !== file.id));
    } else {
      alert("Failed to delete file: " + res.message);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image size={20} className="text-purple-500" />;
    if (type.startsWith('video/')) return <Film size={20} className="text-red-500" />;
    if (type.startsWith('audio/')) return <Music size={20} className="text-pink-500" />;
    if (type.includes('pdf')) return <FileText size={20} className="text-red-600" />;
    if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return <FileText size={20} className="text-green-600" />;
    return <File size={20} className="text-slate-500" />;
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <AlertCircle size={48} className="mb-4 opacity-50" />
        <p>Please log in to manage your documents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center">
          <HardDrive className="mr-3 text-earth-600" size={32} />
          Document Drive
        </h2>
        <p className="text-slate-500">Securely store and manage your personal files and reports.</p>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center space-x-2">
             <span className="text-sm font-bold text-slate-600">{files.length} Files</span>
             {loading && <RefreshCw size={14} className="animate-spin text-slate-400" />}
          </div>
          <div className="flex items-center space-x-3">
             <button onClick={fetchFiles} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full" title="Refresh">
               <RefreshCw size={18} />
             </button>
             <label className={`flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-sm hover:bg-blue-700 cursor-pointer transition-all ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}>
               {uploading ? <Loader2 size={18} className="animate-spin mr-2" /> : <UploadCloud size={18} className="mr-2" />}
               {uploading ? 'Uploading...' : 'Upload File'}
               <input 
                 type="file" 
                 className="hidden" 
                 onChange={handleFileUpload}
                 disabled={uploading}
                 ref={fileInputRef}
               />
             </label>
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100 text-red-600 text-sm flex items-center">
             <AlertCircle size={16} className="mr-2" /> {error}
          </div>
        )}

        {/* File List */}
        <div className="flex-1 overflow-y-auto">
           {files.length === 0 && !loading ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-400">
               <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                 <UploadCloud size={48} className="opacity-20" />
               </div>
               <p className="font-medium">No files uploaded yet.</p>
               <p className="text-sm mt-1">Upload documents to see them here.</p>
             </div>
           ) : (
             <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 z-10">
                 <tr>
                   <th className="px-6 py-3 font-semibold border-b border-slate-100">Name</th>
                   <th className="px-6 py-3 font-semibold border-b border-slate-100">Size</th>
                   <th className="px-6 py-3 font-semibold border-b border-slate-100">Type</th>
                   <th className="px-6 py-3 font-semibold border-b border-slate-100">Uploaded</th>
                   <th className="px-6 py-3 font-semibold border-b border-slate-100 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-sm">
                 {files.map(file => (
                   <tr key={file.id} className="hover:bg-blue-50/50 group transition-colors">
                     <td className="px-6 py-4">
                       <div className="flex items-center">
                         <div className="p-2 bg-slate-100 rounded-lg mr-3">
                           {getFileIcon(file.type)}
                         </div>
                         <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-700 hover:text-blue-600 hover:underline truncate max-w-[200px] md:max-w-xs block">
                           {file.name}
                         </a>
                       </div>
                     </td>
                     <td className="px-6 py-4 text-slate-500 font-mono text-xs">{formatFileSize(file.size)}</td>
                     <td className="px-6 py-4 text-slate-500 max-w-[150px] truncate" title={file.type}>{file.type || 'Unknown'}</td>
                     <td className="px-6 py-4 text-slate-500">{new Date(file.uploadDate).toLocaleDateString()} <span className="text-slate-300 text-xs">{new Date(file.uploadDate).toLocaleTimeString()}</span></td>
                     <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a 
                            href={file.downloadUrl} 
                            download={file.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" 
                            title="Download"
                          >
                            <Download size={18} />
                          </a>
                          <button 
                            onClick={() => handleDelete(file)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           )}
        </div>
      </div>
    </div>
  );
};

export default DocumentsPage;
