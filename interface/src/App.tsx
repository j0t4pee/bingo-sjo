import React, { useState, useEffect, KeyboardEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Wifi, WifiOff, RotateCcw, Play, AlertCircle, 
  HelpCircle, Search, Ticket, LayoutDashboard, Settings, 
  ChevronLeft, ChevronRight, ChevronDown, Store, Plus, Trash2, Save, Upload, X, CheckCircle, Monitor
} from 'lucide-react';

const BACKEND_URL = 'http://localhost:5001';
const socket: Socket = io(BACKEND_URL);

interface RankingItem { tabela: number; faltam: number; numeros: number[]; }

export default function App() {
  const [pedraInput, setPedraInput] = useState('');
  const [sorteados, setSorteados] = useState<number[]>([]);
  const [conectado, setConectado] = useState(false);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [expandedRankingId, setExpandedRankingId] = useState<number | null>(null);
  
  const [currentView, setCurrentView] = useState<'sorteio' | 'conferencia' | 'patrocinadores' | 'config'>('sorteio');

  const [patrocinadores, setPatrocinadores] = useState<Record<string, string | string[]>>({});
  const [patrocinadorNum, setPatrocinadorNum] = useState('');
  const [editandoNum, setEditandoNum] = useState<string | null>(null); 
  const [nomesEditando, setNomesEditando] = useState<string[]>([]);
  const [arquivosUpload, setArquivosUpload] = useState<{ [index: number]: File | null }>({});
  const [imgVersion, setImgVersion] = useState(Date.now()); // Para forçar atualização visual

  const [pedirConfirmacao, setPedirConfirmacao] = useState(true);
  const [usarEnter, setUsarEnter] = useState(true);
  const [tempoPopup, setTempoPopup] = useState(6);

  const [rankingPage, setRankingPage] = useState(0);
  const ITEMS_PER_PAGE = 5;

  const [modalAviso, setModalAviso] = useState<{titulo: string, msg: string, tipo: 'sucesso'|'erro'} | null>(null);
  const [modalConfirmar, setModalConfirmar] = useState<number | null>(null);
  const [modalReiniciar, setModalReiniciar] = useState(false);
  
  const [buscaInput, setBuscaInput] = useState('');
  const [cartelaBuscada, setCartelaBuscada] = useState<{ id: string, numeros: number[] } | null | 'not_found'>(null);

  useEffect(() => {
    socket.on('connect', () => setConectado(true));
    socket.on('disconnect', () => setConectado(false));
    
    socket.on('init', (data: any) => {
      setSorteados(data.pedrasSorteadas || []);
      setPatrocinadores(data.patrocinadores || {});
    });

    socket.on('patrocinadores_atualizados', (novos) => {
      setPatrocinadores(novos);
      setImgVersion(Date.now());
    });
    
    socket.on('pedra_sorteada', (n: number) => setSorteados(prev => [...prev, n]));
    socket.on('ranking_update', (data: RankingItem[]) => setRanking(data));
    socket.on('reseta_jogo', () => { setSorteados([]); setCartelaBuscada(null); setModalReiniciar(false); setRanking([]); setExpandedRankingId(null); });
    socket.on('retorno_cartela', (data: any) => { if (data) setCartelaBuscada(data); else setCartelaBuscada('not_found'); });

    const savedTime = localStorage.getItem('popupDuration');
    if (savedTime) setTempoPopup(Number(savedTime));
    return () => { socket.off(); };
  }, []);

  const handleTempoChange = (e: React.ChangeEvent<HTMLInputElement>) => { let val = parseInt(e.target.value) || 1; if (val > 30) val = 30; setTempoPopup(val); localStorage.setItem('popupDuration', val.toString()); };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { let value = e.target.value.replace(/\D/g, ''); if (Number(value) > 100) value = value.slice(0, 2); if (Number(value) > 100) value = "100"; setPedraInput(value); };
  
  const processarEnvio = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const num = parseInt(pedraInput);
    if (!num || num < 1 || num > 100) { setModalAviso({titulo: 'Erro', msg: 'O número precisa estar entre 1 e 100.', tipo: 'erro'}); return; }
    if (sorteados.includes(num)) { setModalAviso({titulo: 'Atenção', msg: `A pedra ${num} já foi sorteada.`, tipo: 'erro'}); return; }
    if (pedirConfirmacao) setModalConfirmar(num); else enviarDireto(num);
  };

  const enviarDireto = (num: number) => { socket.emit('sortear_pedra', num); setPedraInput(''); setModalConfirmar(null); };
  const confirmarEnvio = () => { if (modalConfirmar !== null) enviarDireto(modalConfirmar); };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && usarEnter && currentView === 'sorteio') { if (modalConfirmar !== null) confirmarEnvio(); else processarEnvio(); } };
  const buscarCartela = (e: React.FormEvent) => { e.preventDefault(); if (!buscaInput) return; setCartelaBuscada(null); socket.emit('buscar_cartela', buscaInput); };
  const confirmarReiniciar = () => { socket.emit('resetar'); };

  const totalPages = Math.ceil(ranking.length / ITEMS_PER_PAGE);
  const currentRanking = ranking.slice(rankingPage * ITEMS_PER_PAGE, (rankingPage + 1) * ITEMS_PER_PAGE);
  const changePage = (dir: number) => { setRankingPage(p => p + dir); setExpandedRankingId(null); };

  const buscarPatrocinadorNum = (numToSearch?: string) => {
    const num = typeof numToSearch === 'string' ? numToSearch : patrocinadorNum;
    if(!num) return;
    
    setEditandoNum(num);
    setPatrocinadorNum(''); 
    const patros = patrocinadores[num];
    setArquivosUpload({});

    if (!patros) setNomesEditando(['']); 
    else if (Array.isArray(patros)) setNomesEditando(patros);
    else setNomesEditando([patros]);
  };

  const lidarComArquivo = (index: number, file: File | null) => {
      setArquivosUpload(prev => ({ ...prev, [index]: file }));
  };

  const salvarPatrocinadoresLocal = async () => {
    if(!editandoNum) return;
    const nomesFinais = nomesEditando.filter(n => n.trim() !== '');
    
    let novoObjeto = { ...patrocinadores };
    if (nomesFinais.length === 0) delete novoObjeto[editandoNum];
    else if (nomesFinais.length === 1) novoObjeto[editandoNum] = nomesFinais[0];
    else novoObjeto[editandoNum] = nomesFinais;
    
    setPatrocinadores(novoObjeto);
    socket.emit('salvar_patrocinadores', novoObjeto);

    for (const key in arquivosUpload) {
        const file = arquivosUpload[key];
        if (file) {
            const formData = new FormData();
            
            // 🔥 A MÁGICA ESTÁ AQUI: O texto precisa ir ANTES da imagem!
            formData.append('numero', editandoNum);
            formData.append('index', key);
            formData.append('imagem', file);

            try { await fetch(`${BACKEND_URL}/upload`, { method: 'POST', body: formData }); } 
            catch (err) { console.error("Erro ao enviar", err); }
        }
    }

    setArquivosUpload({});
    setEditandoNum(null);
    setImgVersion(Date.now()); // Isso avisa o telão para piscar e atualizar na hora!
    setModalAviso({ titulo: 'Sucesso!', msg: 'Nomes e imagens salvos com sucesso! O Telão já foi atualizado.', tipo: 'sucesso' });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; outline: none; font-family: 'Inter', sans-serif; }
        body { background: #0f172a; color: #f8fafc; height: 100vh; overflow: hidden; }
        
        /* ESTILIZAÇÃO DA SCROLLBAR */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #2563eb; }

        .app-container { display: flex; height: 100vh; width: 100vw; }
        .sidebar { width: 260px; background: #1e293b; border-right: 1px solid #334155; display: flex; flex-direction: column; flex-shrink: 0; }
        .brand-area { padding: 30px 20px; text-align: center; border-bottom: 1px solid #334155; }
        .brand-logo { height: 60px; object-fit: contain; margin-bottom: 10px; }
        .brand-title { font-size: 16px; font-weight: 800; color: #f8fafc; text-transform: uppercase; line-height: 1.2; }
        .brand-subtitle { font-size: 11px; color: #94a3b8; letter-spacing: 1px; }
        
        .nav-menu { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 8px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; color: #94a3b8; cursor: pointer; transition: 0.2s; }
        .nav-item:hover { background: #334155; color: #f8fafc; }
        .nav-item.active { background: #3b82f6; color: #ffffff; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
        .nav-item.danger { color: #ef4444; margin-top: auto; }
        .nav-item.danger:hover { background: #ef4444; color: #ffffff; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
        .nav-item.special { background: #10b981; color: white; justify-content: center; margin-top: 15px; }
        .nav-item.special:hover { background: #059669; }

        .conn-footer { padding: 20px; border-top: 1px solid #334155; display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; }

        .main-content { flex: 1; display: flex; flex-direction: column; background: #0f172a; overflow-y: auto; }
        .top-bar { padding: 30px 40px 15px; }
        .view-title { font-size: 28px; font-weight: 800; color: #ffffff; }
        .content-area { padding: 0 40px 40px; display: flex; gap: 30px; }

        .sorteio-grid { display: flex; flex-direction: column; gap: 20px; flex: 1; }
        .ranking-panel { width: 350px; background: #1e293b; border-radius: 16px; border: 1px solid #334155; display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
        .input-card { background: #1e293b; padding: 40px; border-radius: 16px; border: 1px solid #334155; display: flex; align-items: center; justify-content: center; gap: 20px; }
        .input-main { font-size: 90px; font-weight: 800; border: 1px solid #475569; width: 180px; text-align: center; background: #0f172a; color: #ffffff; border-radius: 12px; transition: 0.2s; }
        .input-main:focus { border-color: #3b82f6; }
        .btn-send { background: #3b82f6; color: #fff; border: none; height: 90px; padding: 0 35px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; text-transform: uppercase; transition: 0.2s; }
        .btn-send:hover { background: #2563eb; }

        .history-card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 25px; flex: 1; }
        .history-title { font-size: 14px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 15px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        .nums-flow { font-size: 24px; font-weight: 700; line-height: 1.8; color: #e2e8f0; }
        .comma { color: #64748b; margin: 0 5px; }

        .ranking-header { background: #334155; padding: 15px 20px; font-size: 14px; font-weight: 800; text-transform: uppercase; color: #ffffff; display: flex; justify-content: space-between; align-items: center; }
        .ranking-list { display: flex; flex-direction: column; padding: 15px; gap: 10px; flex: 1; overflow-y: auto; }
        .ranking-item-wrapper { display: flex; flex-direction: column; border-radius: 8px; overflow: hidden; border: 1px solid #334155; transition: 0.2s; }
        .ranking-item-wrapper.is-expanded { border-color: #3b82f6; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        .ranking-item { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 15px; font-size: 15px; font-weight: 600; cursor: pointer; transition: 0.2s; user-select: none; }
        .ranking-item:hover { background: #1e293b; }
        .ranking-item-wrapper.is-expanded .ranking-item { background: #3b82f6; color: #ffffff; }
        .ranking-badge { background: #334155; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 800; transition: 0.2s; }
        .ranking-badge.danger { background: #ef4444; animation: pulse 1.5s infinite; }
        .ranking-item-wrapper.is-expanded .ranking-badge { background: #2563eb; color: #fff; animation: none; }

        .ranking-drawer { background: #0f172a; padding: 15px; border-top: 1px solid #1e293b; }
        .mini-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
        .mini-letra { font-size: 11px; font-weight: 900; color: #94a3b8; text-align: center; padding-bottom: 5px; }
        .mini-num { font-size: 13px; font-weight: 700; background: #1e293b; color: #64748b; text-align: center; padding: 8px 2px; border-radius: 6px; border: 1px solid #334155; }
        .mini-num.hit { background: #10b981; color: #ffffff; border-color: #059669; }
        .ranking-controls { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-top: 1px solid #334155; }
        .btn-page { background: #334155; border: none; color: #fff; padding: 8px; border-radius: 6px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; }
        .btn-page:hover:not(:disabled) { background: #475569; }
        .btn-page:disabled { opacity: 0.5; cursor: not-allowed; }

        .config-panel, .conf-panel { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px; width: 100%; max-width: 750px; margin-top: 20px; }
        .config-item { display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 600; color: #e2e8f0; margin-bottom: 25px; cursor: pointer; }
        .config-item input[type="checkbox"] { width: 20px; height: 20px; accent-color: #3b82f6; cursor: pointer; }
        .time-input { background: #0f172a; border: 1px solid #475569; color: #fff; width: 60px; text-align: center; border-radius: 6px; padding: 8px; font-size: 16px; font-weight: 700; margin: 0 10px; }

        .search-group { display: flex; gap: 15px; margin-bottom: 30px; }
        .search-input { flex: 1; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 15px; border-radius: 8px; font-size: 18px; font-weight: 700; text-align: center; }
        .search-input:focus { border-color: #3b82f6; }
        .btn-search { background: #3b82f6; color: #fff; border: none; padding: 0 25px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: 0.2s; }
        .btn-search:hover { background: #2563eb; }
        .conf-result { border-top: 1px solid #334155; padding-top: 25px; }
        .grid-cartela { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 20px; }
        .letra-cartela { padding: 10px 5px; font-size: 18px; font-weight: 900; border-radius: 8px; border: 1px solid #3b82f6; background: #1e293b; color: #3b82f6; text-align: center; }
        .num-cartela { padding: 15px 5px; font-size: 16px; font-weight: 700; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #94a3b8; text-align: center; }
        .num-cartela.hit { background: #3b82f6; color: #ffffff; border-color: #2563eb; }

        .patrocinador-list { display: flex; flex-direction: column; gap: 15px; margin-top: 20px; }
        
        /* NOVO CARD DE PATROCINADOR REFORMULADO */
        .pat-card { display: flex; gap: 20px; background: #0f172a; padding: 15px; border-radius: 12px; border: 1px solid #334155; align-items: center; }
        .pat-img-preview { width: 90px; height: 90px; background: #1e293b; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px dashed #475569; flex-shrink: 0; }
        .pat-img-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
        
        .pat-info { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .pat-input { width: 100%; background: #1e293b; border: 1px solid #475569; color: #fff; padding: 12px; border-radius: 8px; font-weight: 600; font-size: 15px; }
        .pat-input:focus { border-color: #3b82f6; }
        
        .file-upload-wrapper { position: relative; overflow: hidden; display: inline-block; }
        .file-upload-wrapper input[type=file] { font-size: 100px; position: absolute; left: 0; top: 0; opacity: 0; cursor: pointer; }
        .btn-upload { background: #334155; color: white; border: none; padding: 10px 15px; border-radius: 6px; font-weight: 600; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; font-size: 13px; }
        .btn-upload:hover { background: #475569; }
        .btn-upload.has-file { background: #10b981; }
        
        .btn-add { background: #1e293b; color: #f8fafc; border: 1px dashed #475569; padding: 15px; border-radius: 12px; cursor: pointer; font-weight: 700; margin-top: 10px; transition: 0.2s; }
        .btn-add:hover { background: #334155; }
        .btn-remove { background: #ef4444; color: #fff; border: none; padding: 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .btn-remove:hover { background: #dc2626; }

        .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(5px); }
        .modal { background: #1e293b; border: 1px solid #475569; padding: 40px; border-radius: 16px; text-align: center; width: 90%; max-width: 450px; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
        .modal h2 { font-size: 24px; font-weight: 800; margin-bottom: 15px; color: #f8fafc; }
        .modal p { font-size: 16px; color: #94a3b8; margin-bottom: 30px; line-height: 1.5; }
        .modal-btns { display: flex; gap: 15px; justify-content: center; }
        .btn-m { padding: 15px 25px; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; font-size: 14px; flex: 1; transition: 0.2s; }
        .btn-action { background: #3b82f6; color: #fff; }
        .btn-action:hover { background: #2563eb; }
        .btn-danger-action { background: #ef4444; color: #fff; }
        .btn-light { background: #334155; color: #f8fafc; }
        .btn-light:hover { background: #475569; }
      `}</style>

      <div className="app-container">
        <aside className="sidebar">
          <div className="brand-area">
            <img src="/sjo.png" alt="SJO" className="brand-logo" onError={(e) => e.currentTarget.style.display = 'none'} />
            <div className="brand-title">Paróquia S.J.O.</div>
            <div className="brand-subtitle">Bingo Administrativo</div>
          </div>
          
          <div className="nav-menu">
            <div className={`nav-item ${currentView === 'sorteio' ? 'active' : ''}`} onClick={() => setCurrentView('sorteio')}>
              <LayoutDashboard size={20} /> Painel de Sorteio
            </div>
            <div className={`nav-item ${currentView === 'conferencia' ? 'active' : ''}`} onClick={() => setCurrentView('conferencia')}>
              <Ticket size={20} /> Conferir Cartela
            </div>
            <div className={`nav-item ${currentView === 'patrocinadores' ? 'active' : ''}`} onClick={() => setCurrentView('patrocinadores')}>
              <Store size={20} /> Patrocinadores
            </div>
            <div className={`nav-item ${currentView === 'config' ? 'active' : ''}`} onClick={() => setCurrentView('config')}>
              <Settings size={20} /> Preferências
            </div>
            
            {/* NOVO: BOTÃO DE ABRIR TELÃO */}
            <div className="nav-item special" onClick={() => window.open(window.location.origin + '/telao', '_blank')}>
              <Monitor size={20} /> Abrir Telão
            </div>

            <div className="nav-item danger" onClick={() => setModalReiniciar(true)}>
              <RotateCcw size={20} /> Reiniciar Jogo
            </div>
          </div>

          <div className="conn-footer" style={{ color: conectado ? '#10b981' : '#ef4444' }}>
            {conectado ? <Wifi size={16} /> : <WifiOff size={16} />}
            {conectado ? 'Sistema Online' : 'Sistema Offline'}
          </div>
        </aside>

        <main className="main-content">
          <div className="top-bar">
            <h1 className="view-title">
              {currentView === 'sorteio' && 'Sorteio em Andamento'}
              {currentView === 'conferencia' && 'Conferência de Cartelas'}
              {currentView === 'patrocinadores' && 'Gerenciamento do Telão'}
              {currentView === 'config' && 'Configurações do Sistema'}
            </h1>
          </div>

          <div className="content-area">
            {/* VIEW SORTEIO */}
            {currentView === 'sorteio' && (
              <>
                <div className="sorteio-grid">
                  <div className="input-card">
                    <input className="input-main" type="text" inputMode="numeric" placeholder="00" value={pedraInput} onChange={handleInputChange} onKeyDown={handleKeyDown} autoFocus />
                    <button className="btn-send" onClick={() => processarEnvio()}><Play size={24} fill="currentColor" /> Lançar Pedra</button>
                  </div>
                  <div className="history-card">
                    <div className="history-title">Histórico ({sorteados.length}/100)</div>
                    <div className="nums-flow">
                      {sorteados.length > 0 
                        ? sorteados.map((n, i) => <span key={i}>{n < 10 ? `0${n}` : n}{i !== sorteados.length - 1 && <span className="comma">,</span>}</span>) 
                        : <span style={{color: '#64748b', fontSize:'16px'}}>Aguardando início do jogo...</span>}
                    </div>
                  </div>
                </div>

                <aside className="ranking-panel">
                  <div className="ranking-header">Ranking de Cartelas</div>
                  <div className="ranking-list">
                    {ranking.length === 0 && <div style={{textAlign:'center', color:'#64748b', marginTop:'20px', fontSize:'14px'}}>Sem dados no momento...</div>}
                    {currentRanking.map((r, i) => {
                      const isExpanded = expandedRankingId === r.tabela;
                      return (
                        <div className={`ranking-item-wrapper ${isExpanded ? 'is-expanded' : ''}`} key={i}>
                          <div className="ranking-item" onClick={() => setExpandedRankingId(isExpanded ? null : r.tabela)}>
                            <span>Cartela nº {r.tabela}</span>
                            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                              <span className={`ranking-badge ${r.faltam <= 3 ? 'danger' : ''}`}>Falta(m) {r.faltam}</span>
                              <ChevronDown size={18} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                            </div>
                          </div>
                          {isExpanded && r.numeros && (
                            <div className="ranking-drawer">
                              <div className="mini-grid">
                                {['A', 'M', 'I', 'G', 'O'].map((letra, idx) => <div key={`l-${idx}`} className="mini-letra">{letra}</div>)}
                                {r.numeros.map((num, idx) => (
                                  <div key={idx} className={`mini-num ${sorteados.includes(num) ? 'hit' : ''}`}>{num < 10 ? `0${num}` : num}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="ranking-controls">
                    <button className="btn-page" disabled={rankingPage === 0} onClick={() => changePage(-1)}><ChevronLeft size={18}/></button>
                    <span style={{fontSize: '12px', fontWeight: 600, color: '#94a3b8'}}>PÁG {rankingPage + 1} DE {totalPages || 1}</span>
                    <button className="btn-page" disabled={rankingPage >= totalPages - 1} onClick={() => changePage(1)}><ChevronRight size={18}/></button>
                  </div>
                </aside>
              </>
            )}

            {/* VIEW CONFERENCIA */}
            {currentView === 'conferencia' && (
              <div className="conf-panel">
                <form className="search-group" onSubmit={buscarCartela}>
                  <input type="text" inputMode="numeric" className="search-input" placeholder="Digite o Número da Cartela" value={buscaInput} onChange={(e) => setBuscaInput(e.target.value.replace(/\D/g, ''))} autoFocus />
                  <button type="submit" className="btn-search"><Search size={20} /> Buscar</button>
                </form>
                {cartelaBuscada === 'not_found' && <div className="conf-result"><p style={{color: '#ef4444', fontWeight: 700}}>Cartela não encontrada.</p></div>}
                {cartelaBuscada !== null && cartelaBuscada !== 'not_found' && (
                  <div className="conf-result">
                    <h3 style={{fontSize: '20px', color: '#f8fafc', marginBottom: '5px'}}>Cartela {cartelaBuscada.id}</h3>
                    <div style={{fontSize: '14px', color: '#94a3b8', marginBottom: '20px'}}>
                      {cartelaBuscada.numeros.filter(n => !sorteados.includes(n)).length === 0 
                        ? <span style={{color: '#10b981', fontWeight: 800}}>BINGO CONFIRMADO!</span> 
                        : `Faltam ${cartelaBuscada.numeros.filter(n => !sorteados.includes(n)).length} números para fechar.`}
                    </div>
                    <div className="grid-cartela">
                      {['A', 'M', 'I', 'G', 'O'].map((letra, i) => <div key={`letra-${i}`} className="letra-cartela">{letra}</div>)}
                      {cartelaBuscada.numeros.map((num, i) => (
                        <div key={i} className={`num-cartela ${sorteados.includes(num) ? 'hit' : ''}`}>{num < 10 ? `0${num}` : num}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW PATROCINADORES REFORMULADA */}
            {currentView === 'patrocinadores' && (
              <div className="conf-panel">
                <div style={{marginBottom: '35px'}}>
                  <h3 style={{color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase', marginBottom: '15px', borderBottom: '1px solid #334155', paddingBottom: '10px'}}>
                    Lista de Patrocinadores Cadastrados
                  </h3>
                  
                  {Object.keys(patrocinadores).length === 0 ? (
                    <div style={{background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px dashed #475569', color: '#64748b', textAlign: 'center'}}>
                      Nenhuma marca cadastrada.
                    </div>
                  ) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '5px'}}>
                      {Object.entries(patrocinadores).map(([num, nomes]) => (
                        <div key={num} style={{background: '#0f172a', padding: '12px 15px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <div>
                            <span style={{color: '#FFD700', fontWeight: '900', marginRight: '10px'}}>Pedra {num}</span>
                            <span style={{color: '#e2e8f0', fontWeight: '600'}}>{Array.isArray(nomes) ? nomes.join(', ') : nomes}</span>
                          </div>
                          <button className="btn-search" style={{padding: '6px 15px', fontSize: '13px'}} onClick={() => buscarPatrocinadorNum(num)}>
                            Editar / Ver Foto
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {!editandoNum ? (
                  <div style={{display: 'flex', gap: '15px', background: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #334155'}}>
                    <div style={{flex: 1}}>
                      <h4 style={{color: '#94a3b8', marginBottom: '10px', fontSize: '14px'}}>Adicionar Novo Patrocinador:</h4>
                      <div style={{display: 'flex', gap: '10px'}}>
                        <input type="text" inputMode="numeric" className="search-input" style={{padding: '10px', fontSize: '16px'}} placeholder="Nº da Pedra (ex: 15)" value={patrocinadorNum} onChange={(e) => setPatrocinadorNum(e.target.value.replace(/\D/g, ''))} />
                        <button className="btn-search" onClick={() => buscarPatrocinadorNum()}>Configurar Mídia</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="conf-result" style={{background: '#1e293b', padding: '25px', borderRadius: '16px', border: '2px solid #3b82f6'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                      <h3 style={{color: '#FFD700', margin: 0, fontSize: '24px'}}>Configurando Pedra {editandoNum}</h3>
                      <button style={{background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer'}} onClick={() => { setEditandoNum(null); setPatrocinadorNum(''); }}>
                        <X size={24} />
                      </button>
                    </div>
                    
                    <div className="patrocinador-list" style={{marginTop: 0}}>
                      {nomesEditando.map((nome, index) => {
                        // LÓGICA DE PRÉ-VISUALIZAÇÃO DA IMAGEM
                        const previewSrc = arquivosUpload[index] 
                          ? URL.createObjectURL(arquivosUpload[index] as File) 
                          : `${BACKEND_URL}/patrocinadores/${editandoNum}-${index + 1}.png?v=${imgVersion}`;

                        return (
                          <div className="pat-card" key={index}>
                            {/* CAIXA DA FOTO */}
                            <div className="pat-img-preview">
                              <img 
                                src={previewSrc} 
                                alt="Logo" 
                                onError={(e) => { e.currentTarget.src = '/sjo.png'; e.currentTarget.style.opacity = '0.4'; }} 
                              />
                            </div>
                            
                            {/* ENTRADA DE DADOS */}
                            <div className="pat-info">
                              <input type="text" className="pat-input" value={nome} onChange={(e) => {
                                const novaLista = [...nomesEditando];
                                novaLista[index] = e.target.value;
                                setNomesEditando(novaLista);
                              }} placeholder="Nome da Loja (ex: Oficina do Zé)" />
                              
                              <div style={{display: 'flex', gap: '10px'}}>
                                <div className="file-upload-wrapper">
                                  <button className={`btn-upload ${arquivosUpload[index] ? 'has-file' : ''}`}>
                                      <Upload size={16} /> {arquivosUpload[index] ? 'Pronto para Enviar' : 'Trocar Foto'}
                                  </button>
                                  <input type="file" accept="image/png, image/jpeg" onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) lidarComArquivo(index, e.target.files[0]);
                                  }} />
                                </div>
                                
                                <button className="btn-remove" onClick={() => {
                                    setNomesEditando(nomesEditando.filter((_, i) => i !== index));
                                    const novosArquivos = {...arquivosUpload};
                                    delete novosArquivos[index];
                                    setArquivosUpload(novosArquivos);
                                }}><Trash2 size={18} /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <button className="btn-add" style={{width: '100%', marginBottom: '20px'}} onClick={() => setNomesEditando([...nomesEditando, ''])}>
                      <Plus size={18} style={{display: 'inline', verticalAlign: 'middle'}}/> Adicionar Mais Uma Marca Nesta Pedra
                    </button>
                    <button className="btn-action" style={{width: '100%', padding: '20px', borderRadius: '12px', fontSize: '18px', fontWeight: '800'}} onClick={salvarPatrocinadoresLocal}>
                      <Save size={24} style={{display: 'inline', verticalAlign: 'middle', marginRight: '8px'}}/> Salvar Tudo e Atualizar Telão
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* VIEW CONFIGURAÇÕES */}
            {currentView === 'config' && (
              <div className="config-panel">
                <label className="config-item"><input type="checkbox" checked={pedirConfirmacao} onChange={(e) => setPedirConfirmacao(e.target.checked)} /> Confirmar envio de pedras</label>
                <label className="config-item"><input type="checkbox" checked={usarEnter} onChange={(e) => setUsarEnter(e.target.checked)} /> Usar tecla "Enter" como atalho</label>
                <label className="config-item" style={{cursor: 'default', marginTop: '40px', borderTop: '1px solid #334155', paddingTop: '30px'}}>
                  Tempo do Popup no Telão: <input type="number" className="time-input" min="1" max="30" value={tempoPopup} onChange={handleTempoChange} /> seg
                </label>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MODAL DE AVISO (NOVO E BONITO) */}
      {modalAviso && (
        <div className="overlay" onClick={() => setModalAviso(null)}>
          <div className="modal">
            {modalAviso.tipo === 'sucesso' 
              ? <CheckCircle size={50} color="#10b981" style={{margin: '0 auto', marginBottom: '15px'}} />
              : <AlertCircle size={50} color="#ef4444" style={{margin: '0 auto', marginBottom: '15px'}} />
            }
            <h2 style={{color: modalAviso.tipo === 'sucesso' ? '#10b981' : '#ef4444'}}>{modalAviso.titulo}</h2>
            <p>{modalAviso.msg}</p>
            <button className="btn-m btn-light" onClick={() => setModalAviso(null)}>Entendido</button>
          </div>
        </div>
      )}

      {/* OUTROS MODAIS */}
      {modalReiniciar && (
        <div className="overlay">
          <div className="modal">
            <h2>Reiniciar Jogo?</h2>
            <p>Isso apagará todo o histórico e ranking da rodada.</p>
            <div className="modal-btns">
              <button className="btn-m btn-light" onClick={() => setModalReiniciar(false)}>Cancelar</button>
              <button className="btn-m btn-danger-action" onClick={confirmarReiniciar}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {modalConfirmar !== null && (
        <div className="overlay">
          <div className="modal">
            <HelpCircle size={50} color="#3b82f6" style={{margin: '0 auto', marginBottom: '15px'}} />
            <h2>Lançar Número</h2><p>Enviar a pedra <strong>{modalConfirmar}</strong> para o telão?</p>
            <div className="modal-btns">
              <button className="btn-m btn-light" onClick={() => setModalConfirmar(null)}>Cancelar</button>
              <button className="btn-m btn-action" onClick={confirmarEnvio}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}