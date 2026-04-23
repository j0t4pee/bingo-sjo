import React, { useState, useEffect, KeyboardEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Wifi, WifiOff, RotateCcw, Play, AlertCircle, 
  HelpCircle, Search, Ticket, LayoutDashboard, Settings, 
  ChevronLeft, ChevronRight, ChevronDown, Store, Plus, Trash2, Save, Upload, X, CheckCircle, Monitor,
  Copy, FileText, ImageOff, Filter, History, Edit, Image as ImageIcon
} from 'lucide-react';

const BACKEND_URL = 'http://localhost:5001';
const socket: Socket = io(BACKEND_URL);

interface RankingItem { tabela: number; faltam: number; numeros: number[]; }
interface JogoSalvo { id: number; nome: string; data: string; pedras: number[]; }

export default function App() {
  useEffect(() => {
    const travaAba = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', travaAba);
    return () => window.removeEventListener('beforeunload', travaAba);
  }, []);

  const [senhaReiniciar, setSenhaReiniciar] = useState('');
  const [nomeRodada, setNomeRodada] = useState('');

  const [pedraInput, setPedraInput] = useState('');
  const [sorteados, setSorteados] = useState<number[]>([]);
  const [conectado, setConectado] = useState(false);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [expandedRankingId, setExpandedRankingId] = useState<number | null>(null);
  
  const [currentView, setCurrentView] = useState<'sorteio' | 'conferencia' | 'patrocinadores' | 'relatorios' | 'historico' | 'config'>('sorteio');

  const [rastrearTodas, setRastrearTodas] = useState(true);
  const [listaCartelasStr, setListaCartelasStr] = useState('');

  const [patrocinadores, setPatrocinadores] = useState<Record<string, string | string[]>>({});
  const [patrocinadorNum, setPatrocinadorNum] = useState('');
  const [filtroPatrocinadorNome, setFiltroPatrocinadorNome] = useState('');
  const [editandoNum, setEditandoNum] = useState<string | null>(null); 
  const [nomesEditando, setNomesEditando] = useState<string[]>([]);
  const [arquivosUpload, setArquivosUpload] = useState<{ [index: number]: File | null }>({});
  const [imgVersion, setImgVersion] = useState(Date.now());

  const [relatorioData, setRelatorioData] = useState<{sorteados: number[], patrocinadores: {pedra: string, nome: string, statusImagem: string}[]} | null>(null);
  const [filtroRelatorio, setFiltroRelatorio] = useState<'todos' | 'personalizada' | 'padrao'>('todos');
  const [printScope, setPrintScope] = useState<'tudo' | 'numeros' | 'patrocinadores'>('tudo');
  
  const [historicoSalvo, setHistoricoSalvo] = useState<JogoSalvo[]>([]);

  const [pedirConfirmacao, setPedirConfirmacao] = useState(true);
  const [usarEnter, setUsarEnter] = useState(true);
  const [tempoPopup, setTempoPopup] = useState(6);
  
  const [ocultarRanking, setOcultarRanking] = useState<boolean>(() => {
    return localStorage.getItem('ocultarRanking') === 'true';
  });

  const [rankingPage, setRankingPage] = useState(0);
  const ITEMS_PER_PAGE = 5;

  const [modalAviso, setModalAviso] = useState<{titulo: string, msg: string, tipo: 'sucesso'|'erro'} | null>(null);
  const [modalConfirmar, setModalConfirmar] = useState<number | null>(null);
  const [modalReiniciar, setModalReiniciar] = useState(false);
  const [modalExcluirJogo, setModalExcluirJogo] = useState<number | null>(null);
  
  const [editandoPedraIdx, setEditandoPedraIdx] = useState<number | null>(null);
  const [editandoPedraValor, setEditandoPedraValor] = useState<string>('');
  const [modalConfirmarEdicao, setModalConfirmarEdicao] = useState<{ index: number, oldNum: number, newNum: number } | null>(null);

  const [buscaInput, setBuscaInput] = useState('');
  const [cartelaBuscada, setCartelaBuscada] = useState<{ id: string, numeros: number[] } | null | 'not_found'>(null);

  useEffect(() => {
    document.title = "Painel Admin - Bingo S.J.O.";
    socket.on('connect', () => setConectado(true));
    socket.on('disconnect', () => setConectado(false));
    
    socket.on('init', (data: any) => {
      setSorteados(data.pedrasSorteadas || []);
      setPatrocinadores(data.patrocinadores || {});
      setHistoricoSalvo(data.historicoJogos || []);
      if (data.rastreioConfig) {
        setRastrearTodas(data.rastreioConfig.todas);
        setListaCartelasStr(data.rastreioConfig.lista.join(', '));
      }
      socket.emit('pedir_relatorio'); 
    });

    socket.on('patrocinadores_atualizados', (novos) => { setPatrocinadores(novos); setImgVersion(Date.now()); socket.emit('pedir_relatorio'); });
    socket.on('update_sorteados', (lista: number[]) => setSorteados(lista));
    socket.on('ranking_update', (data: RankingItem[]) => setRanking(data));
    socket.on('historico_atualizado', (historico: JogoSalvo[]) => setHistoricoSalvo(historico));
    socket.on('reseta_jogo', () => { setCartelaBuscada(null); setModalReiniciar(false); setRanking([]); setExpandedRankingId(null); setRelatorioData(null); });
    socket.on('retorno_cartela', (data: any) => { if (data) setCartelaBuscada(data); else setCartelaBuscada('not_found'); });
    socket.on('retorno_relatorio', (data: any) => setRelatorioData(data));

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
  
  const handleEncerrarRodada = () => {
    socket.emit('resetar', { nome: nomeRodada }); 
    setModalReiniciar(false);
    setSenhaReiniciar('');
    setNomeRodada('');
  };

  const handleInlineEditKeyDown = (e: KeyboardEvent<HTMLInputElement>, idx: number, oldNum: number) => {
    if (e.key === 'Enter') {
      const newNum = parseInt(editandoPedraValor);
      if (newNum && newNum >= 1 && newNum <= 100 && newNum !== oldNum) {
        setModalConfirmarEdicao({ index: idx, oldNum, newNum });
      }
      setEditandoPedraIdx(null);
    } else if (e.key === 'Escape') {
      setEditandoPedraIdx(null);
    }
  };

  const totalPages = Math.ceil(ranking.length / ITEMS_PER_PAGE);
  const currentRanking = ranking.slice(rankingPage * ITEMS_PER_PAGE, (rankingPage + 1) * ITEMS_PER_PAGE);
  const changePage = (dir: number) => { setRankingPage(p => p + dir); setExpandedRankingId(null); };

  const salvarConfigRastreio = () => {
    const arr = listaCartelasStr.split(/[\n,]+/).map(s => s.trim()).filter(s => s !== '');
    socket.emit('configurar_rastreio', { todas: rastrearTodas, lista: arr });
    setModalAviso({ titulo: 'Lista Salva', msg: `O painel principal agora exibirá a conferência de ${arr.length} cartelas individuais.`, tipo: 'sucesso' });
  };

  const copiarSorteados = (lista?: number[]) => {
    const texto = (lista || sorteados).map(n => n < 10 ? `0${n}` : n).join(', ');
    navigator.clipboard.writeText(texto);
    setModalAviso({ titulo: 'Copiado!', msg: 'Os números foram copiados para sua área de transferência.', tipo: 'sucesso' });
  };

  const buscarPatrocinadorNum = (numToSearch?: string) => {
    const num = typeof numToSearch === 'string' ? numToSearch : patrocinadorNum;
    if(!num) {
      setModalAviso({titulo: 'Aviso', msg: 'Digite um número para o patrocinador.', tipo: 'erro'});
      return;
    }
    setEditandoNum(num);
    setPatrocinadorNum(''); 
    const patros = patrocinadores[num];
    setArquivosUpload({});
    if (!patros) setNomesEditando(['']); 
    else if (Array.isArray(patros)) setNomesEditando(patros);
    else setNomesEditando([patros]);
  };

  const lidarComArquivo = (index: number, file: File | null) => { setArquivosUpload(prev => ({ ...prev, [index]: file })); };

  const removerImagemPatrocinador = (index: number) => {
    if (!editandoNum) return;
    socket.emit('remover_imagem_patrocinador', { numero: editandoNum, index });
    setImgVersion(Date.now());
    const novosArquivos = {...arquivosUpload};
    delete novosArquivos[index];
    setArquivosUpload(novosArquivos);
    setModalAviso({ titulo: 'Imagem Removida', msg: 'A imagem foi apagada.', tipo: 'sucesso' });
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
            formData.append('numero', editandoNum);
            formData.append('index', key);
            formData.append('imagem', file);
            try { await fetch(`${BACKEND_URL}/upload`, { method: 'POST', body: formData }); } catch (err) { console.error("Erro ao enviar", err); }
        }
    }
    setArquivosUpload({});
    setEditandoNum(null);
    setImgVersion(Date.now());
    socket.emit('pedir_relatorio'); 
    setModalAviso({ titulo: 'Sucesso!', msg: 'Patrocinador salvo e atualizado!', tipo: 'sucesso' });
  };

  const pedirRelatorio = () => { socket.emit('pedir_relatorio'); };

  // CORREÇÃO: Lógica de Filtro Tolerante
  const patrocinadoresFiltradosLista = Object.entries(patrocinadores).filter(([num, nomes]) => {
    const searchTerm = (filtroPatrocinadorNome || '').toLowerCase();
    if (!searchTerm) return true; // Se a busca tiver vazia, retorna tudo
    const listaNomes = Array.isArray(nomes) ? nomes : [nomes];
    const matchName = listaNomes.some(n => n && n.toLowerCase().includes(searchTerm));
    const matchNum = num.includes(searchTerm);
    return matchName || matchNum;
  });

  const patrocinadoresFiltrados = relatorioData?.patrocinadores.filter(p => {
    if (filtroRelatorio === 'personalizada') return p.statusImagem.includes('Personalizada');
    if (filtroRelatorio === 'padrao') return p.statusImagem.includes('Brasão');
    return true; 
  }) || [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; outline: none; font-family: 'Inter', sans-serif; }
        body { background: #0f172a; color: #f8fafc; height: 100vh; overflow: hidden; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #2563eb; }

        .app-container { display: flex; height: 100vh; width: 100vw; }
        .sidebar { width: 250px; background: #1e293b; border-right: 1px solid #334155; display: flex; flex-direction: column; flex-shrink: 0; }
        .brand-area { padding: 30px 20px; text-align: center; border-bottom: 1px solid #334155; }
        .brand-logo { height: 50px; object-fit: contain; margin-bottom: 10px; }
        .brand-title { font-size: 15px; font-weight: 700; color: #f8fafc; text-transform: uppercase; line-height: 1.2; }
        .brand-subtitle { font-size: 11px; color: #94a3b8; letter-spacing: 0.5px; }
        
        .nav-menu { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: 8px; font-size: 14px; font-weight: 500; color: #94a3b8; cursor: pointer; transition: 0.2s; }
        .nav-item:hover { background: #334155; color: #f8fafc; }
        .nav-item.active { background: #3b82f6; color: #ffffff; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2); font-weight: 600; }
        .nav-item.danger { color: #ef4444; margin-top: auto; }
        .nav-item.danger:hover { background: #ef4444; color: #ffffff; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); }
        .nav-item.special { background: #10b981; color: white; justify-content: center; margin-top: 15px; }
        .nav-item.special:hover { background: #059669; }

        .conn-footer { padding: 15px; border-top: 1px solid #334155; display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; }

        .main-content { flex: 1; display: flex; flex-direction: column; background: #0f172a; overflow-y: auto; }
        .top-bar { padding: 30px 40px 15px; }
        .view-title { font-size: 24px; font-weight: 700; color: #ffffff; }
        .content-area { padding: 0 40px 40px; display: flex; gap: 25px; }

        .sorteio-grid { display: flex; flex-direction: column; gap: 20px; flex: 1; }
        .ranking-panel { width: 320px; background: #1e293b; border-radius: 12px; border: 1px solid #334155; display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
        .input-card { background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155; display: flex; align-items: center; justify-content: center; gap: 20px; }
        .input-main { font-size: 70px; font-weight: 700; border: 1px solid #475569; width: 150px; text-align: center; background: #0f172a; color: #ffffff; border-radius: 8px; transition: 0.2s; }
        .input-main:focus { border-color: #3b82f6; }
        .btn-send { background: #3b82f6; color: #fff; border: none; height: 75px; padding: 0 30px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; text-transform: uppercase; transition: 0.2s; }
        .btn-send:hover { background: #2563eb; }

        .history-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; flex: 1; }
        .history-title { font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 15px; border-bottom: 1px solid #334155; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
        .btn-copy { background: #334155; border: none; padding: 6px 12px; border-radius: 6px; color: #f8fafc; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 500; transition: 0.2s; }
        .btn-copy:hover { background: #475569; }
        
        .nums-flow { display: flex; flex-wrap: wrap; gap: 8px; }
        .num-badge-history { background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 8px 12px; border-radius: 8px; font-size: 18px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .num-badge-history:hover { background: #1e293b; border-color: #3b82f6; color: #3b82f6; }
        
        .input-inline-edit { width: 50px; text-align: center; background: #1e293b; color: #FFD700; border: 1px solid #3b82f6; padding: 6px 0; outline: none; }

        .ranking-header { background: #334155; padding: 12px 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; color: #ffffff; display: flex; justify-content: space-between; align-items: center; }
        .ranking-list { display: flex; flex-direction: column; padding: 15px; gap: 8px; flex: 1; overflow-y: auto; }
        .ranking-item-wrapper { display: flex; flex-direction: column; border-radius: 8px; overflow: hidden; border: 1px solid #334155; transition: 0.2s; }
        .ranking-item-wrapper.is-expanded { border-color: #3b82f6; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .ranking-item { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 12px 15px; font-size: 14px; font-weight: 500; cursor: pointer; transition: 0.2s; user-select: none; }
        .ranking-item:hover { background: #1e293b; }
        .ranking-item-wrapper.is-expanded .ranking-item { background: #3b82f6; color: #ffffff; }
        .ranking-badge { background: #334155; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; transition: 0.2s; }
        .ranking-badge.danger { background: #ef4444; animation: pulse 1.5s infinite; }
        .ranking-item-wrapper.is-expanded .ranking-badge { background: #2563eb; color: #fff; animation: none; }

        .ranking-drawer { background: #0f172a; padding: 12px; border-top: 1px solid #1e293b; }
        .mini-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
        .mini-letra { font-size: 10px; font-weight: 700; color: #94a3b8; text-align: center; padding-bottom: 4px; }
        .mini-num { font-size: 12px; font-weight: 600; background: #1e293b; color: #64748b; text-align: center; padding: 6px 2px; border-radius: 4px; border: 1px solid #334155; }
        .mini-num.hit { background: #10b981; color: #ffffff; border-color: #059669; }
        .ranking-controls { display: flex; justify-content: space-between; align-items: center; padding: 12px; border-top: 1px solid #334155; }
        .btn-page { background: #334155; border: none; color: #fff; padding: 6px; border-radius: 4px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; }
        .btn-page:hover:not(:disabled) { background: #475569; }
        .btn-page:disabled { opacity: 0.5; cursor: not-allowed; }

        .config-panel, .conf-panel { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 30px; width: 100%; max-width: 900px; margin-top: 15px; }
        .config-item { display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 500; color: #e2e8f0; margin-bottom: 20px; cursor: pointer; }
        .config-item input[type="radio"], .config-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: #3b82f6; cursor: pointer; }
        .time-input { background: #0f172a; border: 1px solid #475569; color: #fff; width: 50px; text-align: center; border-radius: 6px; padding: 6px; font-size: 14px; font-weight: 600; margin: 0 10px; }

        .search-group { display: flex; gap: 15px; margin-bottom: 20px; }
        .search-input { flex: 1; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 12px 15px; border-radius: 8px; font-size: 14px; font-weight: 500; }
        .search-input:focus { border-color: #3b82f6; }
        .btn-search { background: #3b82f6; color: #fff; border: none; padding: 0 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.2s; font-size: 14px; }
        .btn-search:hover { background: #2563eb; }
        
        .conf-result { border-top: 1px solid #334155; padding-top: 20px; }
        .grid-cartela { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 15px; }
        .letra-cartela { padding: 8px 5px; font-size: 16px; font-weight: 700; border-radius: 6px; border: 1px solid #3b82f6; background: #1e293b; color: #3b82f6; text-align: center; }
        .num-cartela { padding: 12px 5px; font-size: 15px; font-weight: 600; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #94a3b8; text-align: center; }
        .num-cartela.hit { background: #3b82f6; color: #ffffff; border-color: #2563eb; }

        .patrocinadores-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 15px; max-height: 60vh; overflow-y: auto; padding-right: 5px; }
        .pat-card-modern { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 15px; display: flex; flex-direction: column; gap: 12px; transition: 0.2s; }
        .pat-card-modern:hover { border-color: #475569; background: #131d33; }
        .pat-card-modern-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #334155; padding-bottom: 10px; }
        .pat-card-num { background: #FFD700; color: #000; font-weight: 700; padding: 4px 10px; border-radius: 6px; font-size: 13px; }
        .btn-edit-modern { background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 500; cursor: pointer; font-size: 12px; transition: 0.2s; display: flex; align-items: center; gap: 5px;}
        .btn-edit-modern:hover { background: #2563eb; }
        .pat-card-modern-body { display: flex; flex-direction: column; gap: 8px; }
        .pat-mini-item { display: flex; align-items: center; gap: 12px; background: #1e293b; padding: 8px; border-radius: 6px; border: 1px solid #475569; }
        .pat-mini-item img { width: 40px; height: 40px; object-fit: contain; background: #0f172a; border-radius: 4px; padding: 2px; border: 1px solid #334155; flex-shrink: 0; }
        .pat-mini-item span { color: #f8fafc; font-size: 12px; font-weight: 500; flex: 1; word-break: break-word; line-height: 1.3;}

        .pat-card { display: flex; gap: 15px; background: #0f172a; padding: 15px; border-radius: 10px; border: 1px solid #334155; align-items: center; }
        .pat-img-preview { width: 80px; height: 80px; background: #1e293b; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px dashed #475569; flex-shrink: 0; }
        .pat-img-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .pat-info { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .pat-input { width: 100%; background: #1e293b; border: 1px solid #475569; color: #fff; padding: 10px 12px; border-radius: 6px; font-weight: 500; font-size: 14px; }
        .pat-input:focus { border-color: #3b82f6; }
        
        .file-upload-wrapper { position: relative; overflow: hidden; display: inline-block; }
        .file-upload-wrapper input[type=file] { font-size: 100px; position: absolute; left: 0; top: 0; opacity: 0; cursor: pointer; }
        .btn-upload { background: #334155; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-weight: 500; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; font-size: 12px; }
        .btn-upload:hover { background: #475569; }
        .btn-upload.has-file { background: #10b981; }
        
        .btn-add { background: #1e293b; color: #f8fafc; border: 1px dashed #475569; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 600; margin-top: 10px; transition: 0.2s; font-size: 13px; }
        .btn-add:hover { background: #334155; }
        .btn-remove { background: #ef4444; color: #fff; border: none; padding: 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .btn-remove:hover { background: #dc2626; }

        .report-table { width: 100%; border-collapse: collapse; margin-top: 15px; background: #0f172a; border-radius: 8px; overflow: hidden; border: 1px solid #334155; }
        .report-table th, .report-table td { border-bottom: 1px solid #334155; padding: 10px 12px; text-align: left; font-size: 12px; } 
        .report-table th { background: #1e293b; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
        .report-table td { color: #f8fafc; font-weight: 500; }
        .filter-btn { padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid #475569; transition: 0.2s; display: flex; align-items: center; gap: 6px; }

        .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(5px); }
        .modal { background: #1e293b; border: 1px solid #475569; padding: 35px; border-radius: 12px; text-align: center; width: 90%; max-width: 450px; box-shadow: 0 15px 30px rgba(0,0,0,0.4); }
        .modal h2 { font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #f8fafc; }
        .modal p { font-size: 13px; color: #94a3b8; margin-bottom: 25px; line-height: 1.5; }
        .modal-btns { display: flex; gap: 12px; justify-content: center; }
        .btn-m { padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; font-size: 13px; flex: 1; transition: 0.2s; }
        .btn-action { background: #3b82f6; color: #fff; }
        .btn-action:hover { background: #2563eb; }
        .btn-danger-action { background: #ef4444; color: #fff; }
        .btn-light { background: #334155; color: #f8fafc; }
        .btn-light:hover { background: #475569; }
      `}</style>

      {/* PAINEL NORMAL */}
      <div className="app-container">
        <aside className="sidebar">
          <div className="brand-area">
            <img src="/sjo.png" alt="SJO" className="brand-logo" onError={(e) => e.currentTarget.style.display = 'none'} />
            <div className="brand-title">Paróquia S.J.O.</div>
            <div className="brand-subtitle">Bingo Administrativo</div>
          </div>
          
          <div className="nav-menu">
            <div className={`nav-item ${currentView === 'sorteio' ? 'active' : ''}`} onClick={() => setCurrentView('sorteio')}>
              <LayoutDashboard size={18} /> Painel de Sorteio
            </div>
            
            <div className={`nav-item ${currentView === 'patrocinadores' ? 'active' : ''}`} onClick={() => setCurrentView('patrocinadores')}>
              <Store size={18} /> Patrocinadores
            </div>
            
            <div className={`nav-item ${currentView === 'relatorios' ? 'active' : ''}`} onClick={() => { setCurrentView('relatorios'); pedirRelatorio(); }}>
              <FileText size={18} /> Dados do Jogo
            </div>

            <div className={`nav-item ${currentView === 'historico' ? 'active' : ''}`} onClick={() => setCurrentView('historico')}>
              <History size={18} /> Histórico Salvo
            </div>

            <div className={`nav-item ${currentView === 'config' ? 'active' : ''}`} onClick={() => setCurrentView('config')}>
              <Settings size={18} /> Preferências
            </div>
            <div className="nav-item special" onClick={() => window.open(window.location.origin + '/telao', '_blank')}>
              <Monitor size={18} /> Abrir Telão
            </div>
            <div className="nav-item danger" onClick={() => setModalReiniciar(true)}>
              <RotateCcw size={18} /> Encerrar Rodada
            </div>
          </div>

          <div className="conn-footer" style={{ color: conectado ? '#10b981' : '#ef4444' }}>
            {conectado ? <Wifi size={14} /> : <WifiOff size={14} />}
            {conectado ? 'Sistema Online' : 'Sistema Offline'}
          </div>
        </aside>

        <main className="main-content">
          <div className="top-bar">
            <h1 className="view-title">
              {currentView === 'sorteio' && 'Sorteio em Andamento'}
              {currentView === 'conferencia' && 'Conferência de Cartelas'}
              {currentView === 'patrocinadores' && 'Gerenciamento do Telão'}
              {currentView === 'relatorios' && 'Relatório do Jogo Atual'}
              {currentView === 'historico' && 'Banco de Jogos Anteriores'}
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
                    <button className="btn-send" onClick={() => processarEnvio()}><Play size={20} fill="currentColor" /> Lançar Pedra</button>
                  </div>
                  <div className="history-card">
                    <div className="history-title">
                      <span>Histórico ({sorteados.length}/100) - Clique em um número para editar</span>
                      <button className="btn-copy" onClick={() => copiarSorteados()}>
                        <Copy size={12} /> Copiar Números
                      </button>
                    </div>
                    
                    <div className="nums-flow">
                      {sorteados.length > 0 
                        ? sorteados.map((n, i) => (
                            editandoPedraIdx === i ? (
                              <input
                                key={`edit-${i}`}
                                autoFocus
                                className="num-badge-history input-inline-edit"
                                value={editandoPedraValor}
                                onChange={(e) => {
                                  let val = e.target.value.replace(/\D/g, '');
                                  if(Number(val) > 100) val = "100";
                                  setEditandoPedraValor(val);
                                }}
                                onKeyDown={(e) => handleInlineEditKeyDown(e, i, n)}
                                onBlur={() => setEditandoPedraIdx(null)}
                                title="Aperte ENTER para confirmar ou ESC para cancelar"
                              />
                            ) : (
                              <div 
                                key={`num-${i}`} 
                                className="num-badge-history" 
                                title="Clique para editar este número"
                                onClick={() => {
                                  setEditandoPedraIdx(i);
                                  setEditandoPedraValor(n.toString());
                                }}
                              >
                                {n < 10 ? `0${n}` : n}
                              </div>
                            )
                          )) 
                        : <span style={{color: '#64748b', fontSize:'14px'}}>Aguardando início do jogo...</span>}
                    </div>
                  </div>
                </div>

                {!ocultarRanking && (
                  <aside className="ranking-panel">
                    <div className="ranking-header">
                      {rastrearTodas ? "Ranking de Cartelas" : "Consulta Individual"}
                    </div>
                    <div className="ranking-list">
                      {ranking.length === 0 && <div style={{textAlign:'center', color:'#64748b', marginTop:'20px', fontSize:'13px'}}>Nenhuma cartela na lista...</div>}
                      {currentRanking.map((r, i) => {
                        const isExpanded = expandedRankingId === r.tabela;
                        return (
                          <div className={`ranking-item-wrapper ${isExpanded ? 'is-expanded' : ''}`} key={i}>
                            <div className="ranking-item" onClick={() => setExpandedRankingId(isExpanded ? null : r.tabela)}>
                              <span>Cartela nº {r.tabela}</span>
                              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                <span className={`ranking-badge ${r.faltam <= 3 ? 'danger' : ''}`}>Falta(m) {r.faltam}</span>
                                <ChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
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
                      <button className="btn-page" disabled={rankingPage === 0} onClick={() => changePage(-1)}><ChevronLeft size={16}/></button>
                      <span style={{fontSize: '11px', fontWeight: 600, color: '#94a3b8'}}>PÁG {rankingPage + 1} DE {totalPages || 1}</span>
                      <button className="btn-page" disabled={rankingPage >= totalPages - 1} onClick={() => changePage(1)}><ChevronRight size={16}/></button>
                    </div>
                  </aside>
                )}
              </>
            )}

            {/* VIEW CONFERENCIA */}
            {currentView === 'conferencia' && (
              <div className="conf-panel">
                <form className="search-group" onSubmit={buscarCartela}>
                  <input type="text" inputMode="numeric" className="search-input" placeholder="Digite o Número da Cartela" value={buscaInput} onChange={(e) => setBuscaInput(e.target.value.replace(/\D/g, ''))} autoFocus />
                  <button type="submit" className="btn-search"><Search size={18} style={{marginRight:'5px'}} /> Buscar</button>
                </form>
                {cartelaBuscada === 'not_found' && <div className="conf-result"><p style={{color: '#ef4444', fontWeight: 600}}>Cartela não encontrada.</p></div>}
                {cartelaBuscada !== null && cartelaBuscada !== 'not_found' && (
                  <div className="conf-result">
                    <h3 style={{fontSize: '18px', color: '#f8fafc', marginBottom: '5px'}}>Cartela {cartelaBuscada.id}</h3>
                    <div style={{fontSize: '13px', color: '#94a3b8', marginBottom: '15px'}}>
                      {cartelaBuscada.numeros.filter(n => !sorteados.includes(n)).length === 0 
                        ? <span style={{color: '#10b981', fontWeight: 700}}>BINGO CONFIRMADO!</span> 
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

            {/* 🔥 VIEW PATROCINADORES 🔥 */}
            {currentView === 'patrocinadores' && (
              <div className="conf-panel">
                {!editandoNum ? (
                  <>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                      <div className="search-group" style={{ margin: 0, flex: 2, minWidth: '300px' }}>
                        <Search size={18} color="#64748b" style={{position: 'absolute', margin: '11px 15px'}} />
                        <input
                          type="text"
                          className="search-input"
                          style={{ paddingLeft: '40px', textAlign: 'left' }}
                          placeholder="Pesquisar por Nome ou Número da Pedra..."
                          value={filtroPatrocinadorNome}
                          onChange={(e) => setFiltroPatrocinadorNome(e.target.value)}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '220px' }}>
                        <input 
                          type="text" 
                          inputMode="numeric" 
                          className="search-input" 
                          placeholder="Nº (Ex: 15)" 
                          value={patrocinadorNum} 
                          onChange={(e) => setPatrocinadorNum(e.target.value.replace(/\D/g, ''))} 
                        />
                        <button className="btn-search" onClick={() => buscarPatrocinadorNum()}><Plus size={16} style={{marginRight:'5px'}}/> Novo</button>
                      </div>
                    </div>

                    <div className="patrocinadores-grid">
                      {patrocinadoresFiltradosLista.length === 0 ? (
                        <div style={{color:'#64748b', gridColumn: '1 / -1', textAlign: 'center', padding: '40px', background: '#0f172a', borderRadius: '10px', border: '1px dashed #334155'}}>
                          Nenhum patrocinador encontrado. Adicione um novo número na barra acima.
                        </div>
                      ) : (
                        patrocinadoresFiltradosLista.map(([num, nomes]) => {
                          const listaNomes = Array.isArray(nomes) ? nomes : [nomes];
                          return (
                            <div key={num} className="pat-card-modern">
                              <div className="pat-card-modern-header">
                                <span className="pat-card-num">Pedra {num}</span>
                                <button className="btn-edit-modern" onClick={() => buscarPatrocinadorNum(num)}>
                                  <Edit size={12} /> Editar
                                </button>
                              </div>
                              <div className="pat-card-modern-body">
                                {listaNomes.map((nome, idx) => {
                                  const imgSrc = `${BACKEND_URL}/patrocinadores/${num}-${idx + 1}.png?v=${imgVersion}`;
                                  return (
                                    <div key={idx} className="pat-mini-item">
                                      <img src={imgSrc} onError={(e) => e.currentTarget.src='/sjo.png'} alt="Logo Patrocinador" />
                                      <span>{nome}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <div className="conf-result" style={{background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #3b82f6', marginTop: 0}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                      <h3 style={{color: '#FFD700', margin: 0, fontSize: '20px'}}>Configurando Pedra {editandoNum}</h3>
                      <button style={{background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer'}} onClick={() => { setEditandoNum(null); setPatrocinadorNum(''); }}><X size={20} /></button>
                    </div>
                    
                    <div className="patrocinador-list" style={{marginTop: 0}}>
                      {nomesEditando.map((nome, index) => {
                        const previewSrc = arquivosUpload[index] ? URL.createObjectURL(arquivosUpload[index] as File) : `${BACKEND_URL}/patrocinadores/${editandoNum}-${index + 1}.png?v=${imgVersion}`;
                        return (
                          <div className="pat-card" key={index}>
                            <div className="pat-img-preview"><img src={previewSrc} alt="Logo" onError={(e) => { e.currentTarget.src = '/sjo.png'; e.currentTarget.style.opacity = '0.4'; }} /></div>
                            <div className="pat-info">
                              <input type="text" className="pat-input" value={nome} onChange={(e) => { const novaLista = [...nomesEditando]; novaLista[index] = e.target.value; setNomesEditando(novaLista); }} placeholder="Nome da Empresa/Loja" />
                              <div style={{display: 'flex', gap: '8px'}}>
                                <div className="file-upload-wrapper">
                                  <button className={`btn-upload ${arquivosUpload[index] ? 'has-file' : ''}`}><Upload size={14} /> {arquivosUpload[index] ? 'Pronto p/ Enviar' : 'Trocar Foto'}</button>
                                  <input type="file" accept="image/png, image/jpeg" onChange={(e) => { if (e.target.files && e.target.files[0]) lidarComArquivo(index, e.target.files[0]); }} />
                                </div>
                                <button className="btn-upload" style={{background: 'transparent', color: '#ef4444', border: '1px solid #ef4444'}} onClick={() => removerImagemPatrocinador(index)}><ImageOff size={14} /> Apagar Foto</button>
                                <button className="btn-remove" style={{marginLeft: 'auto'}} onClick={() => { setNomesEditando(nomesEditando.filter((_, i) => i !== index)); const novosArquivos = {...arquivosUpload}; delete novosArquivos[index]; setArquivosUpload(novosArquivos); }}><Trash2 size={16} /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button className="btn-add" style={{width: '100%', marginBottom: '15px'}} onClick={() => setNomesEditando([...nomesEditando, ''])}><Plus size={16} style={{display: 'inline', verticalAlign: 'middle', marginRight: '5px'}}/> Adicionar Mais Uma Marca</button>
                    <button className="btn-action" style={{width: '100%', padding: '15px', borderRadius: '8px', fontSize: '15px', fontWeight: '600'}} onClick={salvarPatrocinadoresLocal}><Save size={18} style={{display: 'inline', verticalAlign: 'middle', marginRight: '5px'}}/> Salvar Tudo e Atualizar Telão</button>
                  </div>
                )}
              </div>
            )}

            {/* VIEW RELATÓRIOS */}
            {currentView === 'relatorios' && (
              <div className="conf-panel" data-print={printScope}>
                <div className="print-hide" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #334155', paddingBottom: '10px'}}>
                  <h3 style={{color: '#f8fafc', margin: 0, fontSize: '16px'}}>Visão Geral da Rodada</h3>
                  <div>
                    <button className="btn-action" style={{padding: '8px 15px', borderRadius: '6px', fontSize: '13px'}} onClick={pedirRelatorio}>
                      <RotateCcw size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: '5px'}}/> Atualizar Dados
                    </button>
                  </div>
                </div>

                {!relatorioData ? (
                  <div style={{color: '#94a3b8', textAlign: 'center', padding: '30px', fontSize: '13px'}} className="print-hide">Clique em "Atualizar Dados" para carregar o relatório.</div>
                ) : (
                  <>
                    <div className="print-section-numeros">
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', marginBottom: '10px'}}>
                        <h4 style={{color: '#FFD700', margin: 0, fontSize: '14px'}}>1. Números Sorteados Atualmente ({relatorioData.sorteados.length})</h4>
                      </div>
                      <div style={{background: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155', color: '#e2e8f0', fontSize: '14px', lineHeight: '1.6'}}>
                        {relatorioData.sorteados.length > 0 ? relatorioData.sorteados.join(', ') : 'Nenhum número sorteado ainda.'}
                      </div>
                    </div>

                    <div className="print-section-patrocinadores">
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px', marginBottom: '10px'}}>
                        <h4 style={{color: '#FFD700', margin: 0, fontSize: '14px'}}>2. Status de Patrocinadores ({patrocinadoresFiltrados.length})</h4>
                      </div>
                      <div className="print-hide" style={{display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap'}}>
                        <div style={{color: '#94a3b8', fontSize: '11px', display: 'flex', alignItems: 'center', marginRight: '5px'}}><Filter size={12} style={{marginRight: '5px'}}/> Filtro:</div>
                        <button className="filter-btn" style={{background: filtroRelatorio === 'todos' ? '#3b82f6' : 'transparent', color: filtroRelatorio === 'todos' ? '#fff' : '#94a3b8'}} onClick={() => setFiltroRelatorio('todos')}>Todos</button>
                        <button className="filter-btn" style={{background: filtroRelatorio === 'personalizada' ? '#10b981' : 'transparent', color: filtroRelatorio === 'personalizada' ? '#fff' : '#94a3b8', borderColor: filtroRelatorio === 'personalizada' ? '#059669' : '#475569'}} onClick={() => setFiltroRelatorio('personalizada')}><ImageIcon size={12} /> Personalizadas</button>
                        <button className="filter-btn" style={{background: filtroRelatorio === 'padrao' ? '#475569' : 'transparent', color: filtroRelatorio === 'padrao' ? '#fff' : '#94a3b8'}} onClick={() => setFiltroRelatorio('padrao')}><ImageOff size={12} /> Padrão (Brasão)</button>
                      </div>

                      {patrocinadoresFiltrados.length === 0 ? (
                        <div style={{color: '#94a3b8', fontSize: '13px'}}>Nenhum patrocinador atende ao filtro atual.</div>
                      ) : (
                        <table className="report-table">
                          <thead>
                            <tr><th style={{width: '60px', textAlign: 'center'}}>Pedra</th><th>Nome Cadastrado</th><th>Situação da Imagem</th></tr>
                          </thead>
                          <tbody>
                            {patrocinadoresFiltrados.map((p, i) => (
                              <tr key={i}>
                                <td style={{textAlign: 'center', color: '#FFD700'}}>{p.pedra}</td>
                                <td>{p.nome}</td>
                                <td style={{color: p.statusImagem.includes('Personalizada') ? '#10b981' : '#94a3b8'}}>{p.statusImagem}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* VIEW HISTÓRICO */}
            {currentView === 'historico' && (
              <div className="conf-panel">
                 <h3 style={{color: '#f8fafc', margin: 0, fontSize: '16px', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '15px'}}>Banco de Jogos Anteriores</h3>
                 {historicoSalvo.length === 0 ? (
                   <div style={{color: '#94a3b8', textAlign: 'center', padding: '30px', fontSize: '13px'}}>Nenhum jogo foi encerrado ainda. Quando você encerrar uma rodada, ela ficará salva aqui.</div>
                 ) : (
                   <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                     {historicoSalvo.map((jogo) => (
                       <div key={jogo.id} style={{background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '15px'}}>
                         <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
                           <div>
                             <h4 style={{color: '#FFD700', fontSize: '15px', marginBottom: '4px'}}>{jogo.nome}</h4>
                             <div style={{color: '#64748b', fontSize: '11px'}}>Encerrado em: {jogo.data}</div>
                           </div>
                           <div style={{display: 'flex', gap: '8px'}}>
                             <button className="btn-copy" onClick={() => copiarSorteados(jogo.pedras)}>
                               <Copy size={12} /> Copiar {jogo.pedras.length} n°
                             </button>
                             <button className="btn-copy" style={{background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)'}} onClick={() => setModalExcluirJogo(jogo.id)} title="Excluir jogo">
                               <Trash2 size={14} />
                             </button>
                           </div>
                         </div>
                         <div className="nums-flow">
                           {jogo.pedras.map((n, i) => (
                             <div key={i} className="num-badge-history" style={{cursor: 'default', fontSize: '14px', padding: '6px 10px'}}>{n < 10 ? `0${n}` : n}</div>
                           ))}
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
            )}

            {/* VIEW CONFIGURAÇÕES */}
            {currentView === 'config' && (
              <div className="config-panel">
                <h3 style={{color: '#94a3b8', marginBottom: '15px', fontSize: '14px', borderBottom: '1px solid #334155', paddingBottom: '8px'}}>Preferências Gerais</h3>
                <label className="config-item"><input type="checkbox" checked={pedirConfirmacao} onChange={(e) => setPedirConfirmacao(e.target.checked)} /> Confirmar envio de pedras</label>
                <label className="config-item"><input type="checkbox" checked={usarEnter} onChange={(e) => setUsarEnter(e.target.checked)} /> Usar tecla "Enter" como atalho</label>
                
                <label className="config-item">
                  <input type="checkbox" checked={ocultarRanking} onChange={(e) => { 
                    setOcultarRanking(e.target.checked); 
                    localStorage.setItem('ocultarRanking', String(e.target.checked)); 
                  }} /> 
                  Ocultar painel de cartelas da tela principal
                </label>

                <label className="config-item" style={{cursor: 'default'}}>
                  Tempo do Popup no Telão: <input type="number" className="time-input" min="1" max="30" value={tempoPopup} onChange={handleTempoChange} /> seg
                </label>

                <h3 style={{color: '#94a3b8', marginTop: '30px', marginBottom: '15px', fontSize: '14px', borderBottom: '1px solid #334155', paddingBottom: '8px'}}>Comportamento do Ranking lateral</h3>
                
                <label className="config-item" style={{marginBottom: '10px'}}>
                  <input type="radio" name="visualizacao" checked={rastrearTodas} onChange={() => { setRastrearTodas(true); socket.emit('configurar_rastreio', { todas: true, lista: [] }); }} /> 
                  Conferir todas as cartelas (Ranking Geral)
                </label>

                <label className="config-item" style={{marginBottom: '10px'}}>
                  <input type="radio" name="visualizacao" checked={!rastrearTodas} onChange={() => { setRastrearTodas(false); }} /> 
                  Conferência Individual (Acompanhar IDs específicos)
                </label>

                {!rastrearTodas && (
                  <div style={{background: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px dashed #475569', marginTop: '10px'}}>
                    <p style={{fontSize: '12px', color: '#64748b', marginBottom: '10px'}}>Digite os números das cartelas que você quer acompanhar na tela principal:</p>
                    <textarea className="search-input" rows={3} style={{width: '100%', resize: 'vertical', fontSize: '13px'}} placeholder="Ex: 5, 12, 80" value={listaCartelasStr} onChange={(e) => setListaCartelasStr(e.target.value)} />
                    <button className="btn-action" style={{padding: '10px 15px', borderRadius: '6px', marginTop: '10px', fontSize: '13px', width: '100%'}} onClick={salvarConfigRastreio}>Aplicar no Painel</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {modalAviso && (
        <div className="overlay" onClick={() => setModalAviso(null)}>
          <div className="modal">
            {modalAviso.tipo === 'sucesso' ? <CheckCircle size={40} color="#10b981" style={{margin: '0 auto', marginBottom: '12px'}} /> : <AlertCircle size={40} color="#ef4444" style={{margin: '0 auto', marginBottom: '12px'}} />}
            <h2 style={{color: modalAviso.tipo === 'sucesso' ? '#10b981' : '#ef4444'}}>{modalAviso.titulo}</h2>
            <p>{modalAviso.msg}</p>
            <button className="btn-m btn-light" onClick={() => setModalAviso(null)}>Entendido</button>
          </div>
        </div>
      )}

      {modalConfirmarEdicao !== null && (
        <div className="overlay">
          <div className="modal">
            <HelpCircle size={40} color="#3b82f6" style={{margin: '0 auto', marginBottom: '12px'}} />
            <h2>Confirmar Alteração</h2>
            <p style={{fontSize: '14px'}}>
              Deseja atualizar este número <strong>{modalConfirmarEdicao.oldNum}</strong> para o número <strong style={{color: '#FFD700'}}>{modalConfirmarEdicao.newNum}</strong>?
            </p>
            <div className="modal-btns">
              <button className="btn-m btn-light" onClick={() => setModalConfirmarEdicao(null)}>Cancelar</button>
              <button className="btn-m btn-action" onClick={() => {
                socket.emit('atualizar_pedra', { index: modalConfirmarEdicao.index, oldNum: modalConfirmarEdicao.oldNum, newNum: modalConfirmarEdicao.newNum });
                setModalConfirmarEdicao(null);
              }}>Atualizar Número</button>
            </div>
          </div>
        </div>
      )}

      {modalExcluirJogo !== null && (
        <div className="overlay">
          <div className="modal">
            <AlertCircle size={40} color="#ef4444" style={{margin: '0 auto', marginBottom: '12px'}} />
            <h2>Excluir Jogo Salvo?</h2>
            <p style={{fontSize: '14px'}}>
              Tem certeza que deseja apagar este jogo do histórico? <br/>
              <strong>Esta ação não pode ser desfeita.</strong>
            </p>
            <div className="modal-btns">
              <button className="btn-m btn-light" onClick={() => setModalExcluirJogo(null)}>Cancelar</button>
              <button className="btn-m btn-danger-action" onClick={() => {
                socket.emit('excluir_jogo_salvo', modalExcluirJogo);
                setModalExcluirJogo(null);
                setModalAviso({titulo: 'Excluído', msg: 'O jogo foi removido do histórico com sucesso.', tipo: 'sucesso'});
              }}>Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}

      {modalReiniciar && (
        <div className="overlay">
          <div className="modal">
            <h2>Encerrar Rodada?</h2>
            <p style={{fontSize: '13px', marginBottom: '20px'}}>
              Dê um nome ao prêmio para encerrar o jogo e salvar no banco de dados.
            </p>
            <input type="text" className="search-input" style={{marginBottom: '15px', textAlign: 'center', width: '100%'}} value={nomeRodada} onChange={(e) => setNomeRodada(e.target.value)} placeholder="NOME DA RODADA (Ex: 1º Prêmio - TV)" />
            <input type="text" className="search-input" style={{marginBottom: '20px', textAlign: 'center', textTransform: 'uppercase', width: '100%'}} value={senhaReiniciar} onChange={(e) => setSenhaReiniciar(e.target.value.toLowerCase())} placeholder="DIGITE BINGO PARA CONFIRMAR" />
            <div className="modal-btns">
              <button className="btn-m btn-light" onClick={() => { setModalReiniciar(false); setSenhaReiniciar(''); setNomeRodada(''); }}>Cancelar</button>
              <button className="btn-m btn-action" disabled={senhaReiniciar !== 'bingo' || nomeRodada.trim() === ''} style={{opacity: (senhaReiniciar === 'bingo' && nomeRodada.trim() !== '') ? 1 : 0.5}} onClick={handleEncerrarRodada}>
                Encerrar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalConfirmar !== null && (
        <div className="overlay">
          <div className="modal">
            <HelpCircle size={40} color="#3b82f6" style={{margin: '0 auto', marginBottom: '12px'}} />
            <h2>Lançar Número</h2><p style={{fontSize: '14px'}}>Enviar a pedra <strong>{modalConfirmar}</strong> para o telão?</p>
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