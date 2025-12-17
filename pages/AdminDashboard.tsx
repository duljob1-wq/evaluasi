import React, { useEffect, useState, useRef } from 'react';
import { getTrainings, deleteTraining, getResponses, getGlobalQuestions, saveGlobalQuestion, deleteGlobalQuestion, getContacts, saveContact, deleteContact, getSettings, saveSettings } from '../services/storageService';
import { Training, GlobalQuestion, QuestionType, Contact, Response, AppSettings } from '../types';
import { Plus, Trash2, Eye, Share2, LogOut, X, Copy, Check, BarChart3, Users, Calendar, Link as LinkIcon, Hash, Database, Pencil, LayoutDashboard, Database as DbIcon, FileText, Settings, ToggleLeft, ToggleRight, Search, Contact as ContactIcon, Phone, Save, RotateCcw, Download, FileSpreadsheet, File as FileIcon, Printer, ChevronDown, MessageSquare } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

type MenuTab = 'management' | 'variables' | 'reports' | 'contacts';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MenuTab>('management');
  const navigate = useNavigate();

  // Management State
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [totalResponses, setTotalResponses] = useState(0);

  // Variables State
  const [globalQuestions, setGlobalQuestions] = useState<GlobalQuestion[]>([]);
  const [newQVar, setNewQVar] = useState<{label: string, type: QuestionType, category: 'facilitator'|'process', isDefault: boolean}>({
      label: '', type: 'star', category: 'facilitator', isDefault: false
  });

  // Contacts State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState<{name: string, whatsapp: string}>({ name: '', whatsapp: '' });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  // Reports State
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filteredTrainings, setFilteredTrainings] = useState<Training[]>([]);
  const [exportDropdownId, setExportDropdownId] = useState<string | null>(null); // For tracking which row has export menu open
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; title: string; token: string; accessCode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareTab, setShareTab] = useState<'link' | 'code' | 'token'>('link');

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({ waApiKey: '', waBaseUrl: '', waFooter: '' });

  useEffect(() => {
    refreshData();
    
    // Click outside handler for dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);

  }, []);

  const refreshData = () => {
    const data = getTrainings();
    setTrainings(data);
    setGlobalQuestions(getGlobalQuestions());
    setContacts(getContacts());
    setAppSettings(getSettings()); // Load Settings
    
    let count = 0;
    data.forEach(t => { count += getResponses(t.id).length; });
    setTotalResponses(count);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAdmin');
    navigate('/admin');
  };

  // --- ACTIONS ---

  const handleDeleteTraining = (id: string) => {
    if (confirm('Hapus pelatihan ini?')) {
      deleteTraining(id);
      refreshData();
    }
  };

  const handleSaveVariable = () => {
      if(!newQVar.label) return;
      const newQ: GlobalQuestion = {
          id: uuidv4(),
          label: newQVar.label,
          type: newQVar.type,
          category: newQVar.category,
          isDefault: newQVar.isDefault
      };
      saveGlobalQuestion(newQ);
      setNewQVar({ ...newQVar, label: '' }); // reset label only
      refreshData();
  };

  const handleDeleteVariable = (id: string) => {
      if(confirm('Hapus variabel ini dari database?')) {
          deleteGlobalQuestion(id);
          refreshData();
      }
  };

  const handleToggleDefault = (q: GlobalQuestion) => {
      saveGlobalQuestion({ ...q, isDefault: !q.isDefault });
      refreshData();
  };

  // --- CONTACT ACTIONS ---
  const handleSaveContact = () => {
      if(!newContact.name) return;
      
      const contact: Contact = {
          id: editingContactId || uuidv4(), // Use existing ID if editing, else new UUID
          name: newContact.name,
          whatsapp: newContact.whatsapp
      };

      saveContact(contact);
      
      // Reset form
      setNewContact({ name: '', whatsapp: '' });
      setEditingContactId(null);
      refreshData();
  };

  const handleEditContact = (contact: Contact) => {
      setNewContact({ name: contact.name, whatsapp: contact.whatsapp });
      setEditingContactId(contact.id);
  };

  const handleCancelEditContact = () => {
      setNewContact({ name: '', whatsapp: '' });
      setEditingContactId(null);
  };

  const handleDeleteContact = (id: string) => {
      if(confirm('Hapus kontak ini?')) {
          deleteContact(id);
          // If we were editing this exact contact, reset the form
          if (editingContactId === id) {
              handleCancelEditContact();
          }
          refreshData();
      }
  };

  const handleSaveSettings = () => {
      saveSettings(appSettings);
      setShowSettingsModal(false);
      alert('Pengaturan berhasil disimpan.');
  };

  const applyReportFilter = () => {
      if(!filterStart || !filterEnd) {
          setFilteredTrainings(trainings);
          return;
      }
      const start = new Date(filterStart).getTime();
      const end = new Date(filterEnd).getTime();
      
      const res = trainings.filter(t => {
          const tStart = new Date(t.startDate).getTime();
          const tEnd = new Date(t.endDate).getTime();
          // Check overlapping
          return (tStart <= end && tEnd >= start);
      });
      setFilteredTrainings(res);
  };

  // Initial load for reports
  useEffect(() => {
      setFilteredTrainings(trainings);
  }, [trainings]);

  // --- EXPORT LOGIC ---

  // Helper: Prepare data
  const getReportData = (training: Training) => {
      const responses = getResponses(training.id);
      
      // Calculate Stats Helper
      const calcStats = (items: Response[], questions: any[]) => {
          return questions.map(q => {
              if(q.type === 'text') return { label: q.label, value: 'Teks' };
              const valid = items.filter(r => typeof r.answers[q.id] === 'number');
              const avg = valid.length ? (valid.reduce((a, b) => a + (b.answers[q.id] as number), 0) / valid.length).toFixed(2) : '0';
              return { label: q.label, value: avg };
          });
      };

      // Facilitator Stats
      const facResponses = responses.filter(r => r.type === 'facilitator');
      const facilitators = training.facilitators.map(f => {
          const fRes = facResponses.filter(r => r.targetName === f.name || (r.targetName && r.targetName.includes(f.name)));
          return {
              name: f.name,
              subject: f.subject,
              respondents: fRes.length,
              stats: calcStats(fRes, training.facilitatorQuestions)
          };
      });

      // Process Stats
      const procResponses = responses.filter(r => r.type === 'process');
      const processStats = calcStats(procResponses, training.processQuestions);

      return { facilitators, processStats, procRespondents: procResponses.length };
  };

  const handleExportExcel = (training: Training) => {
      const { facilitators, processStats, procRespondents } = getReportData(training);
      
      let csvContent = `Laporan Evaluasi Pelatihan\n`;
      csvContent += `Judul,${training.title}\n`;
      csvContent += `Periode,${training.startDate} s/d ${training.endDate}\n\n`;

      csvContent += `A. EVALUASI FASILITATOR\n`;
      csvContent += `Nama Fasilitator,Materi,Jumlah Responden,${training.facilitatorQuestions.map(q => q.label).join(',')}\n`;
      
      facilitators.forEach(f => {
          const scores = f.stats.map(s => s.value).join(',');
          csvContent += `"${f.name}","${f.subject}",${f.respondents},${scores}\n`;
      });

      csvContent += `\nB. EVALUASI PENYELENGGARAAN\n`;
      csvContent += `Jumlah Responden,${procRespondents}\n`;
      processStats.forEach(s => {
          csvContent += `"${s.label}",${s.value}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `Laporan_${training.title.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportDropdownId(null);
  };

  const handleExportWord = (training: Training) => {
      const { facilitators, processStats, procRespondents } = getReportData(training);
      
      let html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><title>Laporan Evaluasi</title></head>
        <body style="font-family: Arial, sans-serif;">
        <h1 style="text-align: center;">Laporan Evaluasi Pelatihan</h1>
        <h2 style="text-align: center;">${training.title}</h2>
        <p style="text-align: center;">${new Date(training.startDate).toLocaleDateString('id-ID')} - ${new Date(training.endDate).toLocaleDateString('id-ID')}</p>
        <hr/>
        <h3>A. Evaluasi Fasilitator</h3>
        <table border="1" cellpadding="5" cellspacing="0" style="width:100%; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #f0f0f0;">
                    <th>Nama Fasilitator</th>
                    <th>Materi</th>
                    <th>Responden</th>
                    ${training.facilitatorQuestions.map(q => `<th>${q.label}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${facilitators.map(f => `
                    <tr>
                        <td>${f.name}</td>
                        <td>${f.subject}</td>
                        <td style="text-align:center;">${f.respondents}</td>
                        ${f.stats.map(s => `<td style="text-align:center;">${s.value}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <h3>B. Evaluasi Penyelenggaraan</h3>
        <p>Total Responden: ${procRespondents}</p>
        <table border="1" cellpadding="5" cellspacing="0" style="width:100%; border-collapse: collapse;">
             <thead>
                <tr style="background-color: #f0f0f0;">
                    <th>Aspek Penilaian</th>
                    <th>Rata-rata Nilai</th>
                </tr>
            </thead>
            <tbody>
                ${processStats.map(s => `
                    <tr>
                        <td>${s.label}</td>
                        <td style="text-align:center;">${s.value}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </body></html>
      `;

      const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `Laporan_${training.title.replace(/\s+/g, '_')}.doc`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportDropdownId(null);
  };

  const handleExportPDF = (training: Training) => {
      const { facilitators, processStats, procRespondents } = getReportData(training);
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const html = `
        <html>
        <head>
            <title>Cetak Laporan - ${training.title}</title>
            <style>
                body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; }
                h1 { text-align: center; color: #333; margin-bottom: 5px; }
                h2 { text-align: center; color: #555; font-weight: normal; margin-top: 0; font-size: 16px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; font-size: 12px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f4f4f4; font-weight: bold; }
                .section-title { font-size: 14px; font-weight: bold; color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 5px; margin-top: 30px; }
                .meta { margin-bottom: 40px; border: 1px solid #eee; padding: 15px; border-radius: 8px; background: #fafafa; }
                .score { font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>${training.title}</h1>
            <h2>Laporan Evaluasi Pelatihan</h2>
            
            <div class="meta">
                <strong>Periode Pelaksanaan:</strong> ${new Date(training.startDate).toLocaleDateString('id-ID')} - ${new Date(training.endDate).toLocaleDateString('id-ID')}<br/>
                <strong>Kode Pelatihan:</strong> ${training.accessCode}
            </div>

            <div class="section-title">A. HASIL EVALUASI FASILITATOR</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 20%">Nama Fasilitator</th>
                        <th style="width: 20%">Materi</th>
                        <th style="width: 10%; text-align: center;">Resp.</th>
                        ${training.facilitatorQuestions.map(q => `<th>${q.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${facilitators.map(f => `
                        <tr>
                            <td><strong>${f.name}</strong></td>
                            <td>${f.subject}</td>
                            <td style="text-align: center;">${f.respondents}</td>
                            ${f.stats.map(s => `<td class="score" style="text-align: center;">${s.value}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="section-title">B. HASIL EVALUASI PENYELENGGARAAN</div>
            <p style="font-size: 12px; color: #666;">Total Responden: ${procRespondents}</p>
            <table>
                <thead>
                    <tr>
                        <th>Aspek Penilaian</th>
                        <th style="width: 150px; text-align: center;">Rata-rata Nilai</th>
                    </tr>
                </thead>
                <tbody>
                    ${processStats.map(s => `
                        <tr>
                            <td>${s.label}</td>
                            <td class="score" style="text-align: center;">${s.value}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="margin-top: 50px; font-size: 10px; text-align: center; color: #999;">
                Dicetak otomatis oleh Sistem Evaluasi Pelatihan pada ${new Date().toLocaleString('id-ID')}
            </div>
            
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
      `;
      
      printWindow.document.write(html);
      printWindow.document.close();
      setExportDropdownId(null);
  };


  // --- SHARE MODAL HELPERS ---
  const openShareModal = (training: Training) => {
    const baseUrl = window.location.href.split('#')[0].replace(/\/$/, '');
    const token = btoa(unescape(encodeURIComponent(JSON.stringify(training))));
    const url = `${baseUrl}/#/evaluate/${training.id}?data=${token}`;

    setShareData({ 
        url, 
        title: training.title, 
        token,
        accessCode: training.accessCode || 'N/A' 
    });
    setCopied(false);
    setShareTab('link');
    setShowShareModal(true);
  };

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) {}
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      
      {/* TOP NAVIGATION BAR */}
      <nav className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                  
                  {/* Logo Area */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold">A</div>
                      <span className="font-bold text-lg tracking-tight hidden md:block">Admin<span className="text-indigo-400">Panel</span></span>
                  </div>

                  {/* Horizontal Menu Tabs */}
                  <div className="flex space-x-2 overflow-x-auto no-scrollbar mx-4">
                      <button 
                        onClick={() => setActiveTab('management')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${activeTab === 'management' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                      >
                          <LayoutDashboard size={18} />
                          <span>Manajemen Pelatihan</span>
                      </button>
                      
                      <button 
                        onClick={() => setActiveTab('variables')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${activeTab === 'variables' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                      >
                          <DbIcon size={18} />
                          <span>Variabel Pelatihan</span>
                      </button>

                      <button 
                        onClick={() => setActiveTab('contacts')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${activeTab === 'contacts' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                      >
                          <ContactIcon size={18} />
                          <span>Kontak</span>
                      </button>

                      <button 
                        onClick={() => setActiveTab('reports')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                      >
                          <FileText size={18} />
                          <span>Laporan & Hasil</span>
                      </button>
                  </div>

                  {/* Right Side Actions */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                     <button onClick={() => setShowSettingsModal(true)} className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800" title="Pengaturan">
                         <Settings size={20} />
                     </button>
                     <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-400 px-3 py-2 transition-colors rounded-lg hover:bg-slate-800">
                         <LogOut size={18} /> <span className="text-sm font-medium hidden md:inline">Keluar</span>
                     </button>
                  </div>
              </div>
          </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        
        {/* --- VIEW A: MANAGEMENT --- */}
        {activeTab === 'management' && (
            <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Manajemen Pelatihan</h2>
                        <p className="text-slate-500 text-sm">Kelola daftar pelatihan aktif anda.</p>
                    </div>
                    <Link to="/admin/create" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-200 transition flex items-center gap-2 font-medium">
                        <Plus size={18} /> Buat Baru
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold uppercase">Total Pelatihan</p>
                        <p className="text-2xl font-bold text-slate-800">{trainings.length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold uppercase">Total Responden</p>
                        <p className="text-2xl font-bold text-indigo-600">{totalResponses}</p>
                    </div>
                </div>

                {trainings.length === 0 ? (
                     <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                        <p className="text-slate-400">Belum ada pelatihan.</p>
                     </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {trainings.map(t => (
                            <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col group relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-slate-100 px-3 py-1.5 rounded-bl-xl border-l border-b border-slate-200">
                                    <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mr-1">Kode:</span>
                                    <span className="text-indigo-600 font-mono font-bold text-sm">{t.accessCode}</span>
                                </div>
                                <div className="p-6 pt-10 flex-1">
                                    <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">{t.title}</h3>
                                    <div className="space-y-2 mt-4 text-sm text-slate-500">
                                        <div className="flex items-center gap-2"><Calendar size={14} /> <span>{new Date(t.startDate).toLocaleDateString('id-ID')} - {new Date(t.endDate).toLocaleDateString('id-ID')}</span></div>
                                        <div className="flex items-center gap-2"><Users size={14} /> <span>{t.facilitators.length} Fasilitator</span></div>
                                        {/* Auto Reports Indicator */}
                                        {t.targets && t.targets.length > 0 && (
                                            <div className="flex items-center gap-2 text-indigo-600 font-semibold">
                                                <MessageSquare size={14}/> <span>Auto WA: {t.targets.join(', ')} orang</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                    <button onClick={() => openShareModal(t)} className="text-indigo-600 text-sm font-semibold flex items-center gap-1"><Share2 size={16}/> Share</button>
                                    <div className="flex gap-1">
                                        <Link to={`/admin/results/${t.id}`} className="p-2 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-400 transition"><Eye size={18}/></Link>
                                        <Link to={`/admin/edit/${t.id}`} className="p-2 hover:bg-white hover:text-amber-600 rounded-lg text-slate-400 transition"><Pencil size={18}/></Link>
                                        <button onClick={() => handleDeleteTraining(t.id)} className="p-2 hover:bg-white hover:text-red-600 rounded-lg text-slate-400 transition"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* --- VIEW B: VARIABLES DATABASE --- */}
        {activeTab === 'variables' && (
            <div className="animate-in fade-in duration-300 max-w-4xl mx-auto">
                 <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800">Variabel Pelatihan</h2>
                    <p className="text-slate-500 text-sm">Kelola database pertanyaan. Pertanyaan bertanda 'Default' akan otomatis muncul saat membuat pelatihan baru.</p>
                </div>

                {/* Add New Variable Form */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2"><Plus size={16}/> Tambah Variabel Baru</h3>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4">
                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Pertanyaan</label>
                            <input type="text" value={newQVar.label} onChange={e => setNewQVar({...newQVar, label: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contoh: Penguasaan Materi" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Tipe</label>
                            <select value={newQVar.type} onChange={e => setNewQVar({...newQVar, type: e.target.value as QuestionType})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="star">Star Rating</option>
                                <option value="slider">Slider 0-100</option>
                                <option value="text">Teks Bebas</option>
                            </select>
                        </div>
                        <div className="md:col-span-3">
                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Kategori</label>
                            <select value={newQVar.category} onChange={e => setNewQVar({...newQVar, category: e.target.value as any})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="facilitator">Evaluasi Fasilitator</option>
                                <option value="process">Evaluasi Penyelenggaraan</option>
                            </select>
                        </div>
                        <div className="md:col-span-2 flex items-center pb-2">
                             <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={newQVar.isDefault} onChange={e => setNewQVar({...newQVar, isDefault: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-sm text-slate-600 font-medium">Default?</span>
                             </label>
                        </div>
                        <div className="md:col-span-1">
                            <button onClick={handleSaveVariable} disabled={!newQVar.label} className="w-full bg-slate-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50">Simpan</button>
                        </div>
                    </div>
                </div>

                {/* Variables List */}
                <div className="space-y-6">
                    {['facilitator', 'process'].map(cat => {
                        const items = globalQuestions.filter(q => q.category === cat);
                        return (
                            <div key={cat} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="bg-slate-50/50 px-6 py-3 border-b border-slate-100 font-bold text-slate-700 capitalize">
                                    {cat === 'facilitator' ? 'A. Evaluasi Fasilitator' : 'B. Evaluasi Penyelenggaraan'}
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {items.length === 0 ? <div className="p-4 text-center text-slate-400 text-sm">Tidak ada variabel.</div> : items.map(q => (
                                        <div key={q.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-800 text-sm">{q.label}</p>
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block">{q.type}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <button onClick={() => handleToggleDefault(q)} className={`text-xs font-semibold px-3 py-1 rounded-full border transition ${q.isDefault ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                    {q.isDefault ? 'Default: ON' : 'Default: OFF'}
                                                </button>
                                                <button onClick={() => handleDeleteVariable(q.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )}

        {/* --- VIEW D: CONTACTS --- */}
        {activeTab === 'contacts' && (
             <div className="animate-in fade-in duration-300 max-w-4xl mx-auto">
                 <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800">Kontak Fasilitator</h2>
                    <p className="text-slate-500 text-sm">Kelola data fasilitator agar mudah ditemukan saat membuat jadwal pelatihan baru.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Form Side */}
                    <div className="md:col-span-1">
                         <div className={`bg-white p-6 rounded-2xl shadow-sm border ${editingContactId ? 'border-amber-300' : 'border-slate-200'} sticky top-24 transition-colors`}>
                            <h3 className={`text-sm font-bold uppercase tracking-wide mb-4 flex items-center gap-2 ${editingContactId ? 'text-amber-600' : 'text-slate-700'}`}>
                                {editingContactId ? <Pencil size={16}/> : <Plus size={16}/>} 
                                {editingContactId ? 'Edit Fasilitator' : 'Fasilitator Baru'}
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Nama Lengkap</label>
                                    <input 
                                        type="text" 
                                        value={newContact.name} 
                                        onChange={e => setNewContact({...newContact, name: e.target.value})} 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                                        placeholder="Nama Fasilitator" 
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">No. WhatsApp</label>
                                    <input 
                                        type="text" 
                                        value={newContact.whatsapp} 
                                        onChange={e => setNewContact({...newContact, whatsapp: e.target.value})} 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                                        placeholder="08xxxxxxxx" 
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleSaveContact} 
                                        disabled={!newContact.name} 
                                        className={`flex-1 ${editingContactId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-800 hover:bg-black'} text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition flex items-center justify-center gap-2`}
                                    >
                                        {editingContactId ? <Save size={14} /> : <Plus size={14}/>}
                                        {editingContactId ? 'Update' : 'Simpan'}
                                    </button>
                                    
                                    {editingContactId && (
                                        <button 
                                            onClick={handleCancelEditContact}
                                            className="px-3 py-2.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition"
                                            title="Batal"
                                        >
                                            <RotateCcw size={16}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                         </div>
                    </div>

                    {/* List Side */}
                    <div className="md:col-span-2 space-y-3">
                         {contacts.length === 0 ? (
                             <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                                 <ContactIcon size={32} className="mx-auto mb-2 opacity-50"/>
                                 <p>Belum ada kontak fasilitator.</p>
                             </div>
                         ) : contacts.map(c => (
                             <div key={c.id} className={`bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center group transition ${editingContactId === c.id ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200'}`}>
                                 <div className="flex items-center gap-3">
                                     <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${editingContactId === c.id ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                         {c.name.charAt(0)}
                                     </div>
                                     <div>
                                         <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                                         <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <Phone size={12}/> {c.whatsapp || '-'}
                                         </div>
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <button onClick={() => handleEditContact(c)} className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition">
                                        <Pencil size={18} />
                                    </button>
                                    <button onClick={() => handleDeleteContact(c.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                        <Trash2 size={18}/>
                                    </button>
                                 </div>
                             </div>
                         ))}
                    </div>
                </div>
             </div>
        )}

        {/* --- VIEW C: REPORTS --- */}
        {activeTab === 'reports' && (
             <div className="animate-in fade-in duration-300 min-h-[500px]">
                 <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800">Laporan & Hasil</h2>
                    <p className="text-slate-500 text-sm">Lihat rekapitulasi evaluasi berdasarkan periode waktu.</p>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row items-end gap-4">
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</label>
                        <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Sampai Tanggal</label>
                        <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <button onClick={applyReportFilter} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2">
                        <Search size={18} /> Tampilkan
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Judul Pelatihan</th>
                                <th className="px-6 py-4 font-semibold">Periode</th>
                                <th className="px-6 py-4 font-semibold text-center">Responden</th>
                                <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTrainings.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Tidak ada data pelatihan pada rentang ini.</td></tr>
                            ) : filteredTrainings.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50 transition relative">
                                    <td className="px-6 py-4 font-medium text-slate-800">{t.title}</td>
                                    <td className="px-6 py-4 text-slate-500">
                                        {new Date(t.startDate).toLocaleDateString('id-ID')} - {new Date(t.endDate).toLocaleDateString('id-ID')}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md font-bold text-xs">
                                            {getResponses(t.id).length}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <Link to={`/admin/results/${t.id}`} className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-md text-sm font-semibold transition">
                                                Lihat Detail
                                            </Link>
                                            
                                            {/* Export Dropdown */}
                                            <div className="relative">
                                                <button 
                                                    onClick={() => setExportDropdownId(exportDropdownId === t.id ? null : t.id)}
                                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold border transition ${exportDropdownId === t.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                                                >
                                                    <Download size={14}/> Export <ChevronDown size={12}/>
                                                </button>
                                                
                                                {exportDropdownId === t.id && (
                                                    <div ref={dropdownRef} className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                        <div className="py-1">
                                                            <button onClick={() => handleExportPDF(t)} className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2">
                                                                <Printer size={16} className="text-slate-400"/> PDF (Cetak)
                                                            </button>
                                                            <button onClick={() => handleExportExcel(t)} className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-green-600 flex items-center gap-2">
                                                                <FileSpreadsheet size={16} className="text-slate-400"/> Excel (.csv)
                                                            </button>
                                                            <button onClick={() => handleExportWord(t)} className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2">
                                                                <FileIcon size={16} className="text-slate-400"/> Word (.doc)
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
        )}

      </main>

       {/* Share Modal */}
      {showShareModal && shareData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">Bagikan</h3>
              <button onClick={() => setShowShareModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="p-6">
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button onClick={() => { setShareTab('link'); setCopied(false); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${shareTab === 'link' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}><LinkIcon size={16} className="inline mr-1"/> Link</button>
                <button onClick={() => { setShareTab('code'); setCopied(false); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${shareTab === 'code' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}><Hash size={16} className="inline mr-1"/> Kode</button>
              </div>
              
              {shareTab === 'link' && (
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <input type="text" readOnly value={shareData.url} className="flex-1 bg-transparent border-none text-sm px-2 w-full truncate"/>
                    <button onClick={() => copyToClipboard(shareData.url)} className="p-2 bg-white rounded-lg shadow-sm">{copied ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}</button>
                  </div>
              )}
               {shareTab === 'code' && (
                  <div className="text-center py-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 cursor-pointer hover:border-indigo-300" onClick={() => copyToClipboard(shareData.accessCode)}>
                     <span className="text-4xl font-mono font-bold text-slate-800">{shareData.accessCode}</span>
                     <p className="text-xs text-indigo-500 mt-2">{copied ? 'Tersalin!' : 'Klik untuk salin'}</p>
                  </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Settings size={20} className="text-slate-500"/> Pengaturan Sistem</h3>
                    <button onClick={() => setShowSettingsModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp Gateway API Key (Fonnte)</label>
                        <input 
                            type="text" 
                            value={appSettings.waApiKey} 
                            onChange={(e) => setAppSettings({...appSettings, waApiKey: e.target.value})}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="EK2EfGtaTtnQxdwTnWW7"
                        />
                        <p className="text-xs text-slate-500 mt-1">Default key: EK2EfGtaTtnQxdwTnWW7 (https://api.fonnte.com/send)</p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">API Base URL</label>
                        <input 
                            type="text" 
                            value={appSettings.waBaseUrl} 
                            onChange={(e) => setAppSettings({...appSettings, waBaseUrl: e.target.value})}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="https://api.fonnte.com/send"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Footer Pesan WhatsApp</label>
                        <textarea 
                            value={appSettings.waFooter} 
                            onChange={(e) => setAppSettings({...appSettings, waFooter: e.target.value})}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                            placeholder="Terima kasih..."
                        />
                    </div>
                    <div className="pt-4 flex justify-end">
                        <button onClick={handleSaveSettings} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition">
                            Simpan Pengaturan
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};