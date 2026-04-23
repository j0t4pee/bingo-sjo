import React, { useState, useEffect, KeyboardEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Wifi, WifiOff, RotateCcw, Play, AlertCircle, 
  HelpCircle, Search, Ticket, LayoutDashboard, Settings, 
  ChevronLeft, ChevronRight, ChevronDown, Store, Plus, Trash2, Save, Upload, X, CheckCircle, Monitor,
  Copy, FileText, ImageOff, Image as ImageIcon, Filter, History, Edit3
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

  const [nomeRodada, setNomeRodada] = useState('');
  
  const [pedraInput, setPedraInput] = useState('');
  const [sorteados, setSorteados] = useState<number[]>([]);
  const [conectado, setConectado] = useState(false);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [expandedRankingId, setExpandedRankingId] = useState<number | null>(null);
  
  const [currentView, setCurrentView] = useState<'sorteio' | 'patrocinadores' | 'relatorios' | 'historico' | 'config'>('sorteio');

  const [rastrearTodas, setRastrearTodas] = useState(true);
  const [listaCartelasStr, setListaCartelasStr] = useState('');
  const [mostrarRanking, setMostrarRanking] = useState(true); 

  const [patrocinadores, setPatrocinadores] = useState<Record<string, string | string[]>>({});
  const [patrocinadorNum, setPatrocinadorNum] = useState('');
  const [buscaPatrocinadorInput, setBuscaPatrocinadorInput] = useState(''); 
  const [editandoNum, setEditandoNum] = useState<string | null>(null); 
  const [nomesEditando, setNomesEditando] = useState<string[]>([]);
  const [arquivosUpload, setArquivosUpload] = useState<{ [index: number]: File | null }>({});
  const [imgVersion, setImgVersion] = useState(Date.now());

  const [relatorioData, setRelatorioData] = useState<{sorteados: number[], patrocinadores: {pedra: string, nome: string, statusImagem: string}[]} | null>(null);
  const [filtroRelatorio, setFiltroRelatorio] = useState<'todos' | 'personalizada' | 'padrao'>('todos');
  
  const [historicoSalvo, setHistoricoSalvo] = useState<JogoSalvo[]>([]);

  const [pedirConfirmacao, setPedirConfirmacao] = useState(true);
  const [usarEnter, setUsarEnter] = useState(true);
  const [tempoPopup, setTempoPopup] = useState(6);

  const [rankingPage, setRankingPage] = useState(0);
  const ITEMS_PER_PAGE = 5;

  const [modalAviso, setModalAviso] = useState<{titulo: string, msg: string, tipo: 'sucesso'|'erro'} | null>(null);
  const [modalConfirmar, setModalConfirmar] = useState<number | null>(null);
  const [modalRemoverPedra, setModalRemoverPedra] = useState<number | null>(null);
  const [modalExcluirJogo, setModalExcluirJogo] = useState<number | null>(null);
  const [modalReiniciar, setModalReiniciar] = useState(false);
  
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
    const savedRankingPref = localStorage.getItem('mostrarRanking');
    if (savedRankingPref !== null) setMostrarRanking(savedRankingPref === 'true');

    return () => { socket.off(); };
  }, []);

  const handleTempoChange = (e: React.ChangeEvent<HTMLInputElement>) => { let val = parseInt(e.target.value) || 1; if (val > 30) val = 30; setTempoPopup(val); localStorage.setItem('popupDuration', val.toString()); };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { let value = e.target.value.replace(/\D/g, ''); if (Number(value) > 100) value = value.slice(0, 2); if (Number(value) > 100) value = "100"; setPedraInput(value); };
  
  const processarEnvio = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const num = parseInt(pedraInput);
    if (!num || num < 1 || num > 100) { 
      setModalAviso({titulo: 'Inválido', msg: 'Digite um número entre 1 e 100.', tipo: 'erro'}); 
      return; 
    }
    if (sorteados.includes(num)) { 
      setModalAviso({titulo: 'Pedra Sorteada', msg: `A pedra ${num} já foi chamada! Para removê-la, clique nela na caixa de Histórico ao lado.`, tipo: 'erro'});
      setPedraInput('');
      return; 
    }
    if (pedirConfirmacao) {
      setModalConfirmar(num); 
    } else {
      enviarDireto(num);
    }
  };

  const enviarDireto = (num: number) => { socket.emit('sortear_pedra', num); setPedraInput(''); setModalConfirmar(null); };
  const confirmarEnvio = () => { if (modalConfirmar !== null) enviarDireto(modalConfirmar); };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && usarEnter && currentView === 'sorteio') { if (modalConfirmar !== null) confirmarEnvio(); else processarEnvio(); } };
  const buscarCartela = (e: React.FormEvent) => { e.preventDefault(); if (!buscaInput) return; setCartelaBuscada(null); socket.emit('buscar_cartela', buscaInput); };
  
  const handleEncerrarESalvar = () => {
    socket.emit('resetar', { nome: nomeRodada }); 
    setModalReiniciar(false);
    setNomeRodada('');
  };

  const confirmarExcluirJogo = () => {
    if (modalExcluirJogo !== null) {
      socket.emit('excluir_jogo_salvo', modalExcluirJogo);
      setModalExcluirJogo(null);
    }
  };

  const totalPages = Math.ceil(ranking.length / ITEMS_PER_PAGE);
  const currentRanking = ranking.slice(rankingPage * ITEMS_PER_PAGE, (rankingPage + 1) * ITEMS_PER_PAGE);
  const changePage = (dir: number) => { setRankingPage(p => p + dir); setExpandedRankingId(null); };

  const salvarConfigRastreio = () => {
    const arr = listaCartelasStr.split(/[\n,]+/).map(s => s.trim()).filter(s => s !== '');
    socket.emit('configurar_rastreio', { todas: rastrearTodas, lista: arr });
    setModalAviso({ titulo: 'Salvo', msg: `O painel agora exibe a conferência das cartelas selecionadas.`, tipo: 'sucesso' });
  };

  const copiarSorteados = (lista?: number[]) => {
    const texto = (lista || sorteados).map(n => n < 10 ? `0${n}` : n).join(', ');
    navigator.clipboard.writeText(texto);
    setModalAviso({ titulo: 'Copiado', msg: 'Os números foram copiados para sua área de transferência.', tipo: 'sucesso' });
  };

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

  const lidarComArquivo = (index: number, file: File | null) => { setArquivosUpload(prev => ({ ...prev, [index]: file })); };

  const removerImagemPatrocinador = (index: number) => {
    if (!editandoNum) return;
    socket.emit('remover_imagem_patrocinador', { numero: editandoNum, index });
    setImgVersion(Date.now());
    const novosArquivos = {...arquivosUpload};
    delete novosArquivos[index];
    setArquivosUpload(novosArquivos);
    setModalAviso({ titulo: 'Removida', msg: 'A imagem foi apagada do servidor.', tipo: 'sucesso' });
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
    setModalAviso({ titulo: 'Sucesso', msg: 'Patrocinadores atualizados!', tipo: 'sucesso' });
  };

  const pedirRelatorio = () => { socket.emit('pedir_relatorio'); };

  const patrocinadoresFiltrados = relatorioData?.patrocinadores.filter(p => {
    if (filtroRelatorio === 'personalizada') return p.statusImagem.includes('Personalizada');
    if (filtroRelatorio === 'padrao') return p.statusImagem.includes('Brasão');
    return true; 
  }) || [];

  const patrocinadoresParaExibir = Object.entries(patrocinadores).filter(([num, nomes]) => {
    if (!buscaPatrocinadorInput) return true;
    const termo = buscaPatrocinadorInput.toLowerCase();
    if (num.includes(termo)) return true;
    const lista = Array.isArray(nomes) ? nomes : [nomes];
    return lista.some(n => n.toLowerCase().includes(termo));
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; outline: none; font-family: 'Inter', sans-serif; }
        body { background: #0f172a; color: #f8fafc; height: 100vh; overflow: hidden; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 4px; }
        
        .app-container { display: flex; height: 100vh; width: 100vw; }
        
        .sidebar { width: 260px; background: #1e293b; border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; flex-shrink: 0; z-index: 10; }
        .brand-area { padding: 30px 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .brand-logo { height: 60px; object-fit: contain; margin-bottom: 10px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); }
        .brand-title { font-size: 16px; font-weight: 700; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px; }
        .brand-subtitle { font-size: 11px; color: #94a3b8; letter-spacing: 0.5px; }
        
        .nav-menu { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-radius: 12px; font-size: 14px; font-weight: 500; color: #94a3b8; cursor: pointer; transition: 0.2s; }
        .nav-item:hover { background: #334155; color: #f8fafc; }
        .nav-item.active { background: #3b82f6; color: #ffffff; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); }
        .nav-item.danger { color: #ef4444; margin-top: auto; }
        .nav-item.danger:hover { background: #ef4444; color: #ffffff; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); }
        .nav-item.special { background: #10b981; color: white; justify-content: center; margin-top: 15px; }
        .nav-item.special:hover { background: #059669; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); }

        .conn-footer { padding: 20px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; }

        .main-content { flex: 1; display: flex; flex-direction: column; background: #0f172a; overflow-y: auto; }
        .top-bar { padding: 30px 40px 15px; display: flex; align-items: center; justify-content: space-between; }
        .view-title { font-size: 26px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px; }
        
        .content-area { padding: 0 40px 40px; display: flex; gap: 30px; align-items: flex-start; }

        .glass-card { background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 30px rgba(0,0,0,0.15); padding: 30px; }
        .glass-card-sm { background: #1e293b; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); padding: 20px; }

        /* SORTEIO (LARGURA MAXIMA EXPANDIDA, ALINHADA A ESQUERDA) */
        .sorteio-grid { display: flex; flex-direction: column; gap: 20px; flex: 1; max-width: 800px; }
        .ranking-panel { width: 350px; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; box-shadow: 0 8px 30px rgba(0,0,0,0.15); }
        
        .input-card { display: flex; align-items: stretch; justify-content: flex-start; gap: 20px; padding: 25px; }
        .input-main { font-size: 60px; font-weight: 700; border: none; width: 130px; padding: 10px 0; text-align: center; background: #0f172a; color: #ffffff; border-radius: 12px; transition: 0.2s; box-shadow: inset 0 4px 6px rgba(0,0,0,0.3); height: 75px; }
        .input-main:focus { box-shadow: inset 0 4px 6px rgba(0,0,0,0.3), 0 0 0 2px rgba(59, 130, 246, 0.5); }
        
        .btn-send { background: #3b82f6; color: #fff; border: none; height: 75px; padding: 0 25px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; text-transform: uppercase; transition: 0.2s; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3); }
        .btn-send:hover { background: #2563eb; transform: translateY(-2px); }

        .history-card { flex: 1; display: flex; flex-direction: column; min-height: 250px; }
        .history-title { font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .btn-copy { background: transparent; border: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 8px; color: #f8fafc; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 500; transition: 0.2s; }
        .btn-copy:hover { background: #334155; }
        
        .nums-flow { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 10px; }
        .num-badge-history { background: #334155; border: none; color: #f8fafc; padding: 10px 16px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.2s; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .num-badge-history:hover { background: #ef4444; color: #fff; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3); }

        .ranking-header { background: #334155; padding: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase; color: #ffffff; display: flex; justify-content: space-between; align-items: center; }
        .ranking-list { display: flex; flex-direction: column; padding: 15px; gap: 10px; flex: 1; overflow-y: auto; max-height: 600px; }
        .ranking-item-wrapper { display: flex; flex-direction: column; border-radius: 10px; overflow: hidden; background: #0f172a; transition: 0.2s; }
        .ranking-item-wrapper.is-expanded { background: #3b82f6; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3); }
        .ranking-item { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; font-size: 14px; font-weight: 500; cursor: pointer; transition: 0.2s; user-select: none; color: #f8fafc; }
        .ranking-item:hover { background: #1e293b; }
        .ranking-item-wrapper.is-expanded .ranking-item { color: #ffffff; background: #3b82f6; }
        .ranking-badge { background: #334155; color: white; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; transition: 0.2s; }
        .ranking-badge.danger { background: #ef4444; }
        .ranking-item-wrapper.is-expanded .ranking-badge { background: #2563eb; color: #fff; }

        /* 🔥 ATUALIZAÇÃO DO PADDING INFERIOR DA GAVETA 🔥 */
        .ranking-drawer { background: #0f172a; padding: 20px 20px 30px 20px; }
        
        .mini-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        .mini-letra { font-size: 12px; font-weight: 600; color: #94a3b8; text-align: center; padding-bottom: 5px; }
        .mini-num { font-size: 14px; font-weight: 500; background: #1e293b; color: #64748b; text-align: center; padding: 10px 2px; border-radius: 8px; border: none; }
        .mini-num.hit { background: #10b981; color: #ffffff; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3); }
        .ranking-controls { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.05); }
        .btn-page { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px; border-radius: 8px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; }
        .btn-page:hover:not(:disabled) { background: #334155; }
        .btn-page:disabled { opacity: 0.5; cursor: not-allowed; }

        /* PATROCINADORES - LISTA EXTREMAMENTE MODERNA */
        .sponsor-top-actions { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 30px; align-items: center; }
        .search-input { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 500; transition: 0.2s; flex: 1; }
        .search-input:focus { border-color: #3b82f6; }
        .btn-action { background: #3b82f6; color: #fff; border: none; padding: 12px 25px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
        .btn-action:hover:not(:disabled) { background: #2563eb; transform: translateY(-2px); }
        .btn-action:disabled { cursor: not-allowed; opacity: 0.5; }
        
        .sponsor-modern-list { display: flex; flex-direction: column; gap: 12px; }
        .sponsor-row { display: flex; align-items: center; justify-content: space-between; background: #1e293b; padding: 15px 25px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); transition: 0.2s; }
        .sponsor-row:hover { border-color: rgba(255,255,255,0.1); background: #253347; }
        .sponsor-row-left { display: flex; align-items: center; gap: 20px; }
        .sponsor-avatar { width: 45px; height: 45px; border-radius: 10px; background: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
        .sponsor-avatar img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .sponsor-details { display: flex; flex-direction: column; gap: 4px; }
        .sponsor-details .pedra { color: #FFD700; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .sponsor-details .nome { color: #f8fafc; font-size: 15px; font-weight: 500; }
        .sponsor-row-right { display: flex; align-items: center; gap: 15px; }
        .media-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 5px; }
        .badge-custom { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
        .badge-default { background: rgba(148, 163, 184, 0.1); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2); }
        .btn-edit-minimal { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; padding: 8px 15px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 6px; }
        .btn-edit-minimal:hover { background: #334155; }

        /* PATROCINADORES - TELA DE EDIÇÃO */
        .editor-workspace { background: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08); max-width: 800px; width: 100%; box-shadow: 0 15px 40px rgba(0,0,0,0.2); }
        .editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 20px; }
        .editor-header h3 { color: #FFD700; font-size: 20px; font-weight: 600; margin: 0; }
        .close-btn { background: transparent; border: none; color: #94a3b8; padding: 5px; cursor: pointer; transition: 0.2s; }
        .close-btn:hover { color: #ef4444; }

        .editor-list { display: flex; flex-direction: column; gap: 15px; margin-bottom: 30px; }
        .editor-item { background: #0f172a; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; display: flex; gap: 20px; align-items: center; }
        .editor-img-preview { width: 80px; height: 80px; background: #1e293b; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
        .editor-img-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .editor-form { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .pat-input { width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 12px 15px; border-radius: 8px; font-weight: 500; font-size: 14px; transition: 0.2s; }
        .pat-input:focus { border-color: #3b82f6; }
        .editor-actions { display: flex; gap: 10px; }
        
        .file-upload-wrapper { position: relative; overflow: hidden; display: inline-block; flex: 1; }
        .file-upload-wrapper input[type=file] { font-size: 100px; position: absolute; left: 0; top: 0; opacity: 0; cursor: pointer; }
        .btn-upload { background: #334155; color: white; border: none; padding: 10px 15px; border-radius: 8px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: 0.2s; font-size: 13px; width: 100%; }
        .btn-upload:hover { background: #475569; }
        .btn-upload.has-file { background: #10b981; }
        .btn-remove-img { background: transparent; border: 1px solid rgba(239, 68, 68, 0.5); color: #ef4444; padding: 10px 15px; border-radius: 8px; font-weight: 500; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; font-size: 13px; }
        .btn-remove-img:hover { background: rgba(239, 68, 68, 0.1); border-color: #ef4444; }
        
        .btn-add-marca { background: transparent; color: #3b82f6; border: 1px dashed #3b82f6; padding: 15px; border-radius: 12px; cursor: pointer; font-weight: 500; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; font-size: 14px; }
        .btn-add-marca:hover { background: rgba(59, 130, 246, 0.1); }

        /* CONFIGURAÇÕES E CONFERÊNCIA */
        .config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: start; width: 100%; max-width: 1000px; }
        .config-section { background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.15); }
        .config-header { font-size: 15px; font-weight: 600; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; margin-bottom: 25px; display: flex; align-items: center; gap: 10px; }
        
        .config-item { display: flex; align-items: center; gap: 12px; font-size: 13px; font-weight: 500; color: #e2e8f0; margin-bottom: 20px; cursor: pointer; }
        .config-item input[type="radio"], .config-item input[type="checkbox"] { width: 16px; height: 16px; accent-color: #3b82f6; cursor: pointer; }
        .time-input { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: #fff; width: 60px; text-align: center; border-radius: 6px; padding: 8px; font-size: 14px; margin: 0 10px; }

        .search-group { display: flex; gap: 10px; margin-bottom: 25px; }
        .conf-result { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 25px; }
        .grid-cartela { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 20px; }
        .letra-cartela { padding: 10px 5px; font-size: 14px; font-weight: 600; border-radius: 6px; background: #0f172a; color: #3b82f6; text-align: center; border: 1px solid rgba(255,255,255,0.05); }
        .num-cartela { padding: 12px 5px; font-size: 14px; font-weight: 500; border-radius: 6px; background: #0f172a; color: #94a3b8; text-align: center; border: 1px solid rgba(255,255,255,0.05); transition: 0.2s; }
        .num-cartela.hit { background: #3b82f6; color: #ffffff; border-color: #3b82f6; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }

        /* RELATÓRIOS E LISTAS */
        .report-table { width: 100%; border-collapse: collapse; margin-top: 15px; background: #0f172a; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); }
        .report-table th, .report-table td { padding: 15px 20px; text-align: left; font-size: 13px; border-bottom: 1px solid #1e293b; } 
        .report-table th { background: #1e293b; color: #94a3b8; font-weight: 500; text-transform: uppercase; font-size: 12px; }
        .report-table td { color: #f8fafc; font-weight: 500; }
        
        .filter-btn { padding: 8px 15px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; background: #0f172a; color: #94a3b8; transition: 0.2s; display: flex; align-items: center; gap: 8px; }
        .filter-btn.active { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-color: rgba(59, 130, 246, 0.3); }

        /* MODAIS E OVERLAYS */
        .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { background: #1e293b; padding: 35px; border-radius: 16px; text-align: center; width: 90%; max-width: 420px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 30px 60px rgba(0,0,0,0.6); }
        .modal h2 { font-size: 20px; font-weight: 600; margin-bottom: 10px; color: #f8fafc; }
        .modal p { font-size: 14px; color: #94a3b8; margin-bottom: 25px; line-height: 1.5; font-weight: 400; }
        .modal-btns { display: flex; gap: 10px; justify-content: center; }
        .btn-m { padding: 12px 20px; border-radius: 10px; font-weight: 500; cursor: pointer; border: none; font-size: 14px; flex: 1; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-danger-action { background: #ef4444; color: #fff; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); }
        .btn-danger-action:hover { background: #dc2626; transform: translateY(-2px); }
        .btn-light { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; }
        .btn-light:hover { background: #334155; }
      `}</style>

      <div className="app-container">
        <aside className="sidebar">
          <div className="brand-area">
            <img src="/sjo.png" alt="SJO" className="brand-logo" onError={(e) => e.currentTarget.style.display = 'none'} />
            <div className="brand-title">Paróquia S.J.O.</div>
          </div>
          
          <div className="nav-menu">
            <div className={`nav-item ${currentView === 'sorteio' ? 'active' : ''}`} onClick={() => setCurrentView('sorteio')}>
              <LayoutDashboard size={18} /> Sorteio
            </div>
            <div className={`nav-item ${currentView === 'patrocinadores' ? 'active' : ''}`} onClick={() => setCurrentView('patrocinadores')}>
              <Store size={18} /> Patrocinadores
            </div>
            <div className={`nav-item ${currentView === 'relatorios' ? 'active' : ''}`} onClick={() => { setCurrentView('relatorios'); pedirRelatorio(); }}>
              <FileText size={18} /> Relatórios
            </div>
            <div className={`nav-item ${currentView === 'historico' ? 'active' : ''}`} onClick={() => setCurrentView('historico')}>
              <History size={18} /> Histórico
            </div>
            <div className={`nav-item ${currentView === 'config' ? 'active' : ''}`} onClick={() => setCurrentView('config')}>
              <Settings size={18} /> Configurações
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
              {currentView === 'patrocinadores' && 'Gerenciamento de Marcas'}
              {currentView === 'relatorios' && 'Relatórios do Evento'}
              {currentView === 'historico' && 'Banco de Jogos Anteriores'}
              {currentView === 'config' && 'Preferências e Auditoria'}
            </h1>
          </div>

          <div className="content-area">
            {/* VIEW SORTEIO */}
            {currentView === 'sorteio' && (
              <>
                <div className="sorteio-grid">
                  <div className="input-card glass-card">
                    <input className="input-main" type="text" inputMode="numeric" placeholder="00" value={pedraInput} onChange={handleInputChange} onKeyDown={handleKeyDown} autoFocus />
                    <button className="btn-send" onClick={() => processarEnvio()}>Enviar <Play size={20} fill="currentColor" /></button>
                  </div>
                  <div className="history-card glass-card">
                    <div className="history-title">
                      <span>Histórico ({sorteados.length}/100) - Clique para corrigir</span>
                      <button className="btn-copy" onClick={() => copiarSorteados()}>
                        <Copy size={14} /> Copiar Números
                      </button>
                    </div>
                    <div className="nums-flow">
                      {sorteados.length > 0 
                        ? sorteados.map((n, i) => (
                            <div key={i} className="num-badge-history" onClick={() => setModalRemoverPedra(n)}>
                              {n < 10 ? `0${n}` : n}
                            </div>
                          )) 
                        : <span style={{color: '#64748b', fontSize:'13px'}}>Aguardando início do jogo...</span>}
                    </div>
                  </div>
                </div>

                {mostrarRanking && (
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

            {/* VIEW PATROCINADORES */}
            {currentView === 'patrocinadores' && (
              <div style={{width: '100%', maxWidth: '900px'}}>
                {!editandoNum ? (
                  <>
                    <div className="sponsor-top-actions">
                      <input type="text" className="search-input" placeholder="Pesquisar por número ou nome do patrocinador..." value={buscaPatrocinadorInput} onChange={e => setBuscaPatrocinadorInput(e.target.value)} />
                      <div style={{display: 'flex', gap: '10px'}}>
                        <input type="text" inputMode="numeric" className="search-input" style={{width: '100px', textAlign: 'center'}} placeholder="Pedra" value={patrocinadorNum} onChange={(e) => setPatrocinadorNum(e.target.value.replace(/\D/g, ''))} />
                        <button className="btn-action" onClick={() => buscarPatrocinadorNum()}><Plus size={16} /> Configurar</button>
                      </div>
                    </div>
                    
                    {patrocinadoresParaExibir.length === 0 ? (
                      <div className="glass-card" style={{textAlign: 'center', color: '#64748b', fontSize: '14px'}}>
                        {Object.keys(patrocinadores).length === 0 ? "Nenhuma marca cadastrada." : "Nenhum patrocinador encontrado."}
                      </div>
                    ) : (
                      <div className="sponsor-modern-list">
                        {patrocinadoresParaExibir.map(([num, nomes]) => {
                          const listaNomes = Array.isArray(nomes) ? nomes : [nomes];
                          const imgUrl = `${BACKEND_URL}/patrocinadores/${num}-1.png?v=${imgVersion}`;
                          const temImagemCustom = relatorioData?.patrocinadores.find(p => p.pedra === num)?.statusImagem.includes('Personalizada');

                          return (
                            <div key={num} className="sponsor-row">
                              <div className="sponsor-row-left">
                                <div className="sponsor-avatar">
                                  <img src={temImagemCustom ? imgUrl : "/sjo.png"} alt="Logo" style={{opacity: temImagemCustom ? 1 : 0.5}} onError={(e) => { e.currentTarget.src = '/sjo.png'; e.currentTarget.style.opacity = '0.5'; }} />
                                </div>
                                <div className="sponsor-details">
                                  <span className="pedra">Pedra {num}</span>
                                  <span className="nome">{listaNomes.join(' / ')}</span>
                                </div>
                              </div>
                              <div className="sponsor-row-right">
                                <div style={{display: 'flex', gap: '6px', marginRight: '10px'}}>
                                  {listaNomes.map((nome, idx) => {
                                    const isCustom = relatorioData?.patrocinadores.find(p => p.pedra === num && p.nome === nome)?.statusImagem.includes('Personalizada');
                                    return (
                                      <span key={idx} className={`media-badge ${isCustom ? 'badge-custom' : 'badge-default'}`}>
                                        {isCustom ? <ImageIcon size={10} /> : <ImageOff size={10} />}
                                      </span>
                                    );
                                  })}
                                </div>
                                <button className="btn-edit-minimal" onClick={() => buscarPatrocinadorNum(num)}><Edit3 size={14} /> Editar</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="editor-workspace">
                    <div className="editor-header">
                      <h3>Configurando Pedra {editandoNum}</h3>
                      <button className="close-btn" onClick={() => { setEditandoNum(null); setPatrocinadorNum(''); }}><X size={20} /></button>
                    </div>
                    
                    <div className="editor-list">
                      {nomesEditando.map((nome, index) => {
                        const previewSrc = arquivosUpload[index] ? URL.createObjectURL(arquivosUpload[index] as File) : `${BACKEND_URL}/patrocinadores/${editandoNum}-${index + 1}.png?v=${imgVersion}`;
                        return (
                          <div className="editor-item" key={index}>
                            <div className="editor-img-preview"><img src={previewSrc} alt="Logo" onError={(e) => { e.currentTarget.src = '/sjo.png'; e.currentTarget.style.opacity = '0.3'; }} /></div>
                            <div className="editor-form">
                              <input type="text" className="pat-input" value={nome} onChange={(e) => { const novaLista = [...nomesEditando]; novaLista[index] = e.target.value; setNomesEditando(novaLista); }} placeholder="Nome do Patrocinador" />
                              <div className="editor-actions">
                                <div className="file-upload-wrapper">
                                  <button className={`btn-upload ${arquivosUpload[index] ? 'has-file' : ''}`}><Upload size={14} /> Trocar Foto</button>
                                  <input type="file" accept="image/png, image/jpeg" onChange={(e) => { if (e.target.files && e.target.files[0]) lidarComArquivo(index, e.target.files[0]); }} />
                                </div>
                                <button className="btn-remove-img" onClick={() => removerImagemPatrocinador(index)}><ImageOff size={14} /> Apagar Foto</button>
                                <button className="btn-remove-img" style={{background: 'transparent', border: '1px solid #475569', color: '#94a3b8'}} onClick={() => { setNomesEditando(nomesEditando.filter((_, i) => i !== index)); const novosArquivos = {...arquivosUpload}; delete novosArquivos[index]; setArquivosUpload(novosArquivos); }}><Trash2 size={14} /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button className="btn-add-marca" onClick={() => setNomesEditando([...nomesEditando, ''])}><Plus size={16} /> Adicionar Espaço Nesta Pedra</button>
                    <button className="btn-action" style={{width: '100%', marginTop: '20px', padding: '16px', borderRadius: '10px', fontSize: '15px', justifyContent: 'center'}} onClick={salvarPatrocinadoresLocal}><Save size={18} /> Salvar e Atualizar Telão</button>
                  </div>
                )}
              </div>
            )}

            {/* VIEW RELATÓRIOS */}
            {currentView === 'relatorios' && (
              <div className="glass-card" style={{width: '100%', maxWidth: '900px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '15px'}}>
                  <h3 style={{color: '#f8fafc', margin: 0, fontSize: '18px'}}>Visão Geral do Evento</h3>
                  <div>
                    <button className="btn-action" style={{padding: '8px 15px', borderRadius: '6px', fontWeight: '600', fontSize: '13px'}} onClick={pedirRelatorio}>
                      <RotateCcw size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: '5px'}}/> Atualizar Dados
                    </button>
                  </div>
                </div>

                {!relatorioData ? (
                  <div style={{color: '#94a3b8', textAlign: 'center', padding: '40px', fontSize: '15px'}}>Clique em "Atualizar Dados".</div>
                ) : (
                  <>
                    <div className="print-section-numeros">
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '15px'}}>
                        <h4 style={{color: '#FFD700', margin: 0, fontSize: '15px'}}>1. Pedras Sorteadas ({relatorioData.sorteados.length})</h4>
                      </div>
                      <div className="glass-card-sm" style={{color: '#e2e8f0', fontSize: '16px', fontWeight: '600', lineHeight: '1.8'}}>
                        {relatorioData.sorteados.length > 0 ? relatorioData.sorteados.join(', ') : 'Nenhum número sorteado.'}
                      </div>
                    </div>

                    <div className="print-section-patrocinadores" style={{marginTop: '40px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                        <h4 style={{color: '#FFD700', margin: 0, fontSize: '15px'}}>2. Auditoria de Patrocinadores ({patrocinadoresFiltrados.length})</h4>
                      </div>
                      
                      <div style={{display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: '#0f172a', padding: '10px', borderRadius: '10px'}}>
                        <div style={{color: '#94a3b8', fontSize: '13px', display: 'flex', alignItems: 'center', marginRight: '10px', fontWeight: 500}}><Filter size={16} style={{marginRight: '6px'}}/> Filtros:</div>
                        <button className={`filter-btn ${filtroRelatorio === 'todos' ? 'active' : ''}`} onClick={() => setFiltroRelatorio('todos')}>Exibir Todos</button>
                        <button className={`filter-btn ${filtroRelatorio === 'personalizada' ? 'active' : ''}`} onClick={() => setFiltroRelatorio('personalizada')}><ImageIcon size={14} /> Imagens Customizadas</button>
                        <button className={`filter-btn ${filtroRelatorio === 'padrao' ? 'active' : ''}`} onClick={() => setFiltroRelatorio('padrao')}><ImageOff size={14} /> Brasão Padrão</button>
                      </div>

                      {patrocinadoresFiltrados.length === 0 ? (
                        <div style={{color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '20px'}}>Nenhum patrocinador encontrado neste filtro.</div>
                      ) : (
                        <table className="report-table">
                          <thead>
                            <tr><th style={{width: '80px', textAlign: 'center'}}>Pedra</th><th>Nome Cadastrado</th><th>Situação da Imagem</th></tr>
                          </thead>
                          <tbody>
                            {patrocinadoresFiltrados.map((p, i) => (
                              <tr key={i}>
                                <td style={{textAlign: 'center', color: '#FFD700', fontWeight: 700}}>{p.pedra}</td>
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

            {/* VIEW HISTÓRICO DE JOGOS SALVOS */}
            {currentView === 'historico' && (
              <div className="glass-card" style={{width: '100%', maxWidth: '900px'}}>
                 <h3 style={{color: '#f8fafc', margin: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', marginBottom: '25px', fontSize: '20px'}}>Banco de Jogos Encerrados</h3>
                 {historicoSalvo.length === 0 ? (
                   <div style={{color: '#64748b', textAlign: 'center', padding: '40px', fontSize: '15px'}}>Nenhuma rodada foi salva no banco de dados.</div>
                 ) : (
                   <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                     {historicoSalvo.map((jogo) => (
                       <div key={jogo.id} className="glass-card-sm" style={{background: '#0f172a'}}>
                         <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px'}}>
                           <div>
                             <h4 style={{color: '#FFD700', fontSize: '18px', marginBottom: '6px', fontWeight: 700}}>{jogo.nome}</h4>
                             <div style={{color: '#94a3b8', fontSize: '13px'}}>Encerrado em: {jogo.data}</div>
                           </div>
                           <div style={{display: 'flex', gap: '10px'}}>
                             <button className="btn-copy" style={{padding: '10px 15px'}} onClick={() => copiarSorteados(jogo.pedras)}>
                               <Copy size={16} /> Copiar {jogo.pedras.length} números
                             </button>
                             <button className="btn-copy" style={{background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '10px 15px'}} onClick={() => setModalExcluirJogo(jogo.id)}>
                               <Trash2 size={16} />
                             </button>
                           </div>
                         </div>
                         <div className="nums-flow">
                           {jogo.pedras.map((n, i) => (
                             <div key={i} className="num-badge-history" style={{cursor: 'default', background: '#1e293b'}}>{n < 10 ? `0${n}` : n}</div>
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
              <div className="config-grid">
                <div style={{display: 'flex', flexDirection: 'column', gap: '30px'}}>
                  <div className="config-section">
                    <div className="config-header"><Settings size={16}/> Preferências Gerais</div>
                    <label className="config-item"><input type="checkbox" checked={pedirConfirmacao} onChange={(e) => setPedirConfirmacao(e.target.checked)} /> Confirmar antes de enviar pedra ao Telão</label>
                    <label className="config-item"><input type="checkbox" checked={usarEnter} onChange={(e) => setUsarEnter(e.target.checked)} /> Usar tecla "Enter" como atalho de envio</label>
                    <label className="config-item">
                      <input type="checkbox" checked={mostrarRanking} onChange={(e) => { setMostrarRanking(e.target.checked); localStorage.setItem('mostrarRanking', e.target.checked.toString()); }} /> 
                      Mostrar Painel de Ranking na tela de Sorteio
                    </label>
                    <label className="config-item" style={{cursor: 'default', marginTop: '25px'}}>
                      Tempo do Destaque no Telão: <input type="number" className="time-input" min="1" max="30" value={tempoPopup} onChange={handleTempoChange} /> seg
                    </label>
                  </div>

                  <div className="config-section">
                    <div className="config-header"><LayoutDashboard size={16}/> Filtro do Ranking de Cartelas</div>
                    <label className="config-item"><input type="radio" name="visualizacao" checked={rastrearTodas} onChange={() => { setRastrearTodas(true); socket.emit('configurar_rastreio', { todas: true, lista: [] }); }} /> 
                      Modo Padrão (Exibir todas)
                    </label>
                    <label className="config-item"><input type="radio" name="visualizacao" checked={!rastrearTodas} onChange={() => { setRastrearTodas(false); }} /> 
                      Modo Restrito (Apenas IDs específicos)
                    </label>

                    {!rastrearTodas && (
                      <div style={{background: '#0f172a', padding: '15px', borderRadius: '10px', marginTop: '15px'}}>
                        <textarea className="pat-input" rows={2} style={{width: '100%', resize: 'vertical'}} placeholder="Ex: 5, 12, 80" value={listaCartelasStr} onChange={(e) => setListaCartelasStr(e.target.value)} />
                        <button className="btn-action" style={{padding: '10px', borderRadius: '8px', marginTop: '10px', width: '100%', justifyContent: 'center', fontSize: '13px'}} onClick={salvarConfigRastreio}>Aplicar Filtro</button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="config-section" style={{minHeight: '400px'}}>
                  <div className="config-header"><Ticket size={16}/> Ferramenta de Auditoria Manual</div>
                  <p style={{fontSize: '12px', color: '#94a3b8', marginBottom: '20px', lineHeight: '1.5'}}>Caso haja dúvida na pista, digite o ID da cartela para cruzar os números dela com as pedras já sorteadas no globo.</p>
                  
                  <form className="search-group" onSubmit={buscarCartela}>
                    <input type="text" inputMode="numeric" className="search-input" placeholder="ID da Cartela" value={buscaInput} onChange={(e) => setBuscaInput(e.target.value.replace(/\D/g, ''))} />
                    <button type="submit" className="btn-action" style={{padding: '0 20px'}}><Search size={18} /></button>
                  </form>

                  {cartelaBuscada === 'not_found' && <div className="conf-result"><p style={{color: '#ef4444', fontWeight: 500, textAlign: 'center', padding: '20px 0', fontSize: '13px'}}>Cartela não encontrada.</p></div>}
                  
                  {cartelaBuscada !== null && cartelaBuscada !== 'not_found' && (
                    <div className="conf-result">
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px'}}>
                        <h3 style={{fontSize: '18px', color: '#f8fafc', margin: 0}}>Cartela {cartelaBuscada.id}</h3>
                        <div style={{fontSize: '12px', color: '#94a3b8'}}>
                          {cartelaBuscada.numeros.filter(n => !sorteados.includes(n)).length === 0 
                            ? <span style={{color: '#10b981', fontWeight: 600, padding: '4px 8px', background: 'rgba(16,185,129,0.1)', borderRadius: '6px'}}>BINGO VALIDADO</span> 
                            : `Faltam ${cartelaBuscada.numeros.filter(n => !sorteados.includes(n)).length} números.`}
                        </div>
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

              </div>
            )}
          </div>
        </main>
      </div>

      {modalAviso && (
        <div className="overlay" onClick={() => setModalAviso(null)}>
          <div className="modal">
            {modalAviso.tipo === 'sucesso' ? <CheckCircle size={45} color="#10b981" style={{margin: '0 auto', marginBottom: '15px'}} /> : <AlertCircle size={45} color="#ef4444" style={{margin: '0 auto', marginBottom: '15px'}} />}
            <h2>{modalAviso.titulo}</h2>
            <p>{modalAviso.msg}</p>
            <button className="btn-m btn-light" onClick={() => setModalAviso(null)}>OK</button>
          </div>
        </div>
      )}

      {/* MODAL DE REMOVER PEDRA */}
      {modalRemoverPedra !== null && (
        <div className="overlay">
          <div className="modal">
            <AlertCircle size={45} color="#ef4444" style={{margin: '0 auto', marginBottom: '15px'}} />
            <h2>Corrigir Número</h2>
            <p>A pedra {modalRemoverPedra} já foi sorteada. Deseja removê-la do histórico?</p>
            <div className="modal-btns">
              <button className="btn-m btn-light" onClick={() => setModalRemoverPedra(null)}>Cancelar</button>
              <button className="btn-m btn-danger-action" onClick={() => { socket.emit('remover_pedra', modalRemoverPedra); setModalRemoverPedra(null); }}>Remover Pedra</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUIR JOGO SALVO */}
      {modalExcluirJogo !== null && (
        <div className="overlay">
          <div className="modal">
            <AlertCircle size={45} color="#ef4444" style={{margin: '0 auto', marginBottom: '15px'}} />
            <h2>Excluir Registro?</h2>
            <p>Isso removerá este jogo permanentemente do banco de dados.</p>
            <div className="modal-btns">
              <button className="btn-m btn-light" onClick={() => setModalExcluirJogo(null)}>Cancelar</button>
              <button className="btn-m btn-danger-action" onClick={confirmarExcluirJogo}>Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REINICIAR (SIMPLIFICADO) */}
      {modalReiniciar && (
        <div className="overlay">
          <div className="modal">
            <h2>Encerrar Rodada</h2>
            <p>Para registrar no banco de dados, digite o nome do prêmio ou do ganhador.</p>
            <input type="text" className="pat-input" style={{marginBottom: '25px', textAlign: 'center', fontSize: '15px'}} value={nomeRodada} onChange={(e) => setNomeRodada(e.target.value)} placeholder="Ex: 1º Prêmio - TV 50" />
            <div className="modal-btns">
              <button className="btn-m btn-light" onClick={() => { setModalReiniciar(false); setNomeRodada(''); }}>Cancelar</button>
              <button className="btn-m btn-action" disabled={nomeRodada.trim() === ''} style={{opacity: nomeRodada.trim() !== '' ? 1 : 0.5}} onClick={handleEncerrarESalvar}>
                Encerrar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalConfirmar !== null && (
        <div className="overlay">
          <div className="modal">
            <HelpCircle size={45} color="#3b82f6" style={{margin: '0 auto', marginBottom: '15px'}} />
            <h2>Lançar Número</h2>
            <p>Confirmar o sorteio da pedra <strong>{modalConfirmar}</strong>?</p>
            <div className="modal-btns">
              <button className="btn-m btn-light" onClick={() => setModalConfirmar(null)}>Cancelar</button>
              <button className="btn-m btn-action" onClick={confirmarEnvio}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}