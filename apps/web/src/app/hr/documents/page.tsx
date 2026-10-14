'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Upload,
  Download,
  Shield,
  FileCheck,
  Building2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function DocumentsPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    staffId: '',
    title: '',
    type: 'CONTRACT',
    fileUrl: '',
  });

  const loadDocuments = () => {
    fetch('/api/hr/documents')
      .then((r) => r.json())
      .then((d) => setDocuments(d.documents || []))
      .catch((err) => console.error('Failed to load documents:', err));
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/hr/employees?limit=200').then((r) => r.json()),
      fetch('/api/hr/documents').then((r) => r.json()),
    ])
      .then(([empData, docData]) => {
        setEmployees(empData.employees || []);
        setDocuments(docData.documents || []);
      })
      .catch((err) => console.error('Failed to initialize document data:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.staffId || !form.title) return;
    setSubmitting(true);
    try {
      let fileUrl = form.fileUrl;
      if (selectedFile) {
        const uploadData = new FormData(); uploadData.append('file', selectedFile);
        const uploadResponse = await fetch('/api/hr/documents/upload', { method: 'POST', body: uploadData });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadResult.error || 'File upload failed');
        fileUrl = uploadResult.url;
      }
      if (!fileUrl) throw new Error('Select a file or provide a secure file URL');
      const res = await fetch('/api/hr/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: form.staffId,
          title: form.title,
          type: form.type,
          fileUrl,
        }),
      });
      if (res.ok) {
        setUploadModalOpen(false);
        setForm({ staffId: '', title: '', type: 'CONTRACT', fileUrl: '' }); setSelectedFile(null);
        loadDocuments();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to upload document');
      }
    } catch (err: any) {
      alert(err.message || 'Upload error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDocs = documents.filter((d) =>
    search ? (d.title?.toLowerCase().includes(search.toLowerCase()) || d.employee?.toLowerCase().includes(search.toLowerCase())) : true
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-400" />
            Employee Document Vault &amp; Files
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Employment contracts, NIN/BVN credentials, food handler health certificates, and company policies.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setUploadModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Document
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Documents</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{documents.length}</span>
            <FileCheck className="w-4 h-4 text-teal-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Secured in repository</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Verified Records</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">
              {documents.filter((d) => d.verified).length}
            </span>
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Audit verified files</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Compliance Vault</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-cyan-300">Active</span>
            <Shield className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Tenant isolated &amp; encrypted</span>
        </div>
      </div>

      {/* Document Table */}
      <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search documents by employee or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500 text-xs h-8"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#060a12] border-b border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Document Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Upload Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    {loading ? 'Loading documents...' : 'No documents uploaded yet.'}
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-400" />
                      {doc.title}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {doc.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200">{doc.employee}</td>
                    <td className="py-3 px-4 text-slate-400">{doc.department}</td>
                    <td className="py-3 px-4 text-slate-500">{doc.date}</td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/api/hr/self-service/documents/${doc.id}`, '_blank', 'noopener,noreferrer')}
                        className="text-teal-400 hover:text-teal-300 text-xs h-7 px-2"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Document Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-teal-400" />
              Upload Employee Document
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Employee *</label>
              <select
                required
                value={form.staffId}
                onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.department})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Document Title *</label>
              <Input
                required
                placeholder="e.g. 2026 Employment Contract"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Document Category</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="CONTRACT">Employment Contract</option>
                <option value="IDENTITY">NIN / National ID / Passport</option>
                <option value="MEDICAL">Food Handler Medical Clearance</option>
                <option value="CERTIFICATE">Academic / Professional Certificate</option>
                <option value="POLICY">Signed Policy / Handbook Acknowledgement</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Select File (PDF, PNG, JPG)</label>
              <Input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="bg-slate-950 border-slate-800 text-slate-300 text-xs h-9 cursor-pointer"
              />
              <p className="mt-1 text-[10px] text-slate-500">PDF, PNG or JPG up to 10 MB. Files are stored in the configured document repository.</p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setUploadModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Uploading...' : 'Upload File'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
