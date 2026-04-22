import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Trophy, Bell, Radio } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5001';
const socket: Socket = io(BACKEND_URL);

interface Alerta { tabela: number; nome: string; faltam: number; bingo?: boolean; }

export default function Telao() {
  const [sorteados, setSorteados] = useState<number[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [pedraDestaque, setPedraDestaque] = useState<number | null>(null);
  const [patrocinadoresBase, setPatrocinadoresBase] = useState<Record<string, string | string[]>>({});
  
  const [imgVersion, setImgVersion] = useState<number>(Date.now());
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    socket.on('init', (data: any) => {
      setSorteados(data.pedrasSorteadas || []);
      setPatrocinadoresBase(data.patrocinadores || {});
    });
    
    socket.on('patrocinadores_atualizados', (novos) => {
      setPatrocinadoresBase(novos);
      setImgVersion(Date.now()); 
    });
    
    socket.on('pedra_sorteada', (n: number) => {
      setSorteados(prev => [...prev, n]);
      setPedraDestaque(n); 
      
      const tempoSegundos = Number(localStorage.getItem('popupDuration') || 6);
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = setTimeout(() => setPedraDestaque(null), tempoSegundos * 1000);
    });

    socket.on('alerta_proximidade', (data: Alerta[]) => setAlertas(data));
    socket.on('reseta_jogo', () => { setSorteados([]); setAlertas([]); setPedraDestaque(null); });

    return () => { socket.off(); };
  }, []);

  const ultimoSorteado = sorteados[sorteados.length - 1] || null;

  const getSponsorsList = (num: number | null) => {
    if (!num) return [];
    const data = patrocinadoresBase[num.toString()];
    if (!data) return ["BINGO PARÓQUIA SÃO JOSÉ"];
    return Array.isArray(data) ? data : [data];
  };

  const currentSponsors = getSponsorsList(ultimoSorteado);
  const popupSponsors = getSponsorsList(pedraDestaque);
  
  const proximasCount = alertas.filter(a => a.faltam === 1).length;
  const cartelasBingo = alertas.filter(a => a.bingo === true);
  const temBingo = cartelasBingo.length > 0;

  const getImageUrl = (num: number, idx: number) => {
    return `${BACKEND_URL}/patrocinadores/${num}-${idx + 1}.png?v=${imgVersion}`;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!e.currentTarget.src.includes('sjo.png')) {
      e.currentTarget.src = '/sjo.png';
      e.currentTarget.style.opacity = '0.8';
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Montserrat', sans-serif; }
        
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #FFD700; border-radius: 4px; }
        
        .telao-bg { display: flex; height: 100vh; width: 100vw; background: #0a0a0a; color: #ffffff; padding: 25px; gap: 25px; overflow: hidden; }
        .sidebar { width: 32%; display: flex; flex-direction: column; gap: 20px; }
        .top-stats { display: flex; gap: 15px; flex-shrink: 0; }
        .stat-box { flex: 1; background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 15px; text-align: center; }
        .stat-label { font-size: 12px; color: #737373; font-weight: 700; text-transform: uppercase; margin-bottom: 5px; display: block; }
        .stat-num { font-size: 38px; font-weight: 900; color: #ffffff; }
        .stat-num.gold { color: #FFD700; }
        
        /* 🔥 CAIXA AMARELA AJUSTADA (Mais fina, fontes mantidas) 🔥 */
        .gold-box { background: #FFD700; border-radius: 16px; padding: 25px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; flex-shrink: 0; box-shadow: 0 8px 25px rgba(255, 215, 0, 0.15); }
        .gold-label { font-size: 28px; color: #523b08; font-weight: 900; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
        .gold-number { font-size: 150px; font-weight: 900; color: #000000; line-height: 0.85; margin-bottom: 0px;}
        
        /* 🔥 ALERTA REPOSICIONADO 🔥 */
        .monitor-container { background: #000000; border-radius: 12px; padding: 15px; display: flex; align-items: center; justify-content: center; border: 2px solid #262626; flex-shrink: 0; }
        .monitor-status { color: #FFD700; font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; animation: blink-animation 1.5s steps(2, start) infinite; display: flex; align-items: center; gap: 10px; }
        @keyframes blink-animation { to { visibility: hidden; } }
        
        /* 🔥 PATROCINADORES SEPARADOS LÁ EMBAIXO 🔥 */
        .sponsor-list-wrapper { display: flex; flex-direction: column; gap: 15px; width: 100%; align-items: center; overflow-y: auto; flex: 1; padding-right: 5px; }
        .sponsor-white-box { background: #ffffff; border-radius: 12px; padding: 15px; width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; flex-direction: column; align-items: center; gap: 10px; border: 2px solid #262626;}
        .sponsor-img-sidebar { max-height: 75px; object-fit: contain; }
        .sponsor-name-sidebar { color: #000000; font-size: 16px; font-weight: 900; text-align: center; text-transform: uppercase; line-height: 1.1; }
        
        .grid-area { flex: 1; background: #141414; border-radius: 16px; padding: 30px; border: 1px solid #262626; display: flex; flex-direction: column; }
        .grid-header { font-size: 28px; font-weight: 900; text-align: center; margin-bottom: 25px; color: #ffffff; text-transform: uppercase; }
        .grid-container { display: grid; grid-template-columns: repeat(10, 1fr); gap: 12px; height: 100%; }
        .cell { display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 800; color: #333; background: #0a0a0a; border-radius: 8px; border: 1px solid #1a1a1a; transition: 0.3s; }
        .cell.sorteada { color: #FFD700; background: #1c190a; border-color: #423b12; }
        .cell.ultima { background: #FFD700; color: #000; transform: scale(1.1); box-shadow: 0 0 25px rgba(255, 215, 0, 0.4); border: none; z-index: 10; }
        
        .popup-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.92); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 500; }
        .popup-card { text-align: center; width: 100%; animation: scalePopup 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .popup-header { font-size: 28px; color: #FFD700; font-weight: 900; text-transform: uppercase; margin-bottom: 20px; display: flex; justify-content: center; align-items: center; gap: 10px; }
        .popup-number { font-size: 280px; font-weight: 900; color: #ffffff; line-height: 1; margin-bottom: 40px; }
        .popup-sponsors-grid { display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; padding: 0 40px; }
        .popup-white-box { background: #ffffff; border-radius: 20px; padding: 25px; min-width: 300px; max-width: 450px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .popup-img-large { max-height: 160px; max-width: 100%; object-fit: contain; }
        .popup-name-large { color: #000000; font-size: 28px; font-weight: 900; text-align: center; text-transform: uppercase; line-height: 1.1; }
        
        .bingo-overlay { position: fixed; inset: 0; background: rgba(10, 5, 0, 0.95); backdrop-filter: blur(15px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: bingoBgFlash 1s infinite alternate; }
        .bingo-card { text-align: center; border: 6px solid #FFD700; padding: 60px 80px; border-radius: 40px; background: #0a0a0a; box-shadow: 0 0 100px rgba(255, 215, 0, 0.6); animation: epicPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .bingo-title { font-size: 130px; font-weight: 900; color: #FFD700; margin: 20px 0 10px; line-height: 1; text-transform: uppercase; }
        .bingo-subtitle { font-size: 45px; font-weight: 900; color: #ffffff; margin-bottom: 30px; text-transform: uppercase; }
        .bingo-instruction { font-size: 28px; font-weight: 700; color: #FFD700; margin-bottom: 40px; background: #1c190a; padding: 15px 30px; border-radius: 12px; display: inline-block; border: 2px dashed #DAA520; animation: pulseInstruction 1.5s infinite; }
        .bingo-cartelas-list { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
        .bingo-badge { background: #FFD700; color: #000000; padding: 15px 30px; border-radius: 16px; font-size: 36px; font-weight: 900; text-transform: uppercase; box-shadow: 0 10px 20px rgba(255, 215, 0, 0.3); }
        
        @keyframes scalePopup { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes epicPop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes bingoBgFlash { from { background: rgba(10, 5, 0, 0.95); } to { background: rgba(30, 20, 0, 0.95); } }
        @keyframes pulseInstruction { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
      `}</style>

      <div className="telao-bg">
        <aside className="sidebar">
          {/* ESTATÍSTICAS DO TOPO */}
          <div className="top-stats">
            <div className="stat-box"><span className="stat-label">Sorteados</span><span className="stat-num">{sorteados.length}</span></div>
            <div className="stat-box"><span className="stat-label">Restantes</span><span className="stat-num gold">{100 - sorteados.length}</span></div>
          </div>

          {/* CAIXA AMARELA (Só número agora) */}
          <div className="gold-box">
            <div className="gold-label">Último Número</div>
            <div className="gold-number">
              {ultimoSorteado ? (ultimoSorteado < 10 ? `0${ultimoSorteado}` : ultimoSorteado) : '--'}
            </div>
          </div>

          {/* AVISO DE BINGO PISCANTE */}
          {proximasCount > 0 && !temBingo && (
            <div className="monitor-container">
              <div className="monitor-status">
                <Radio size={20} />
                {proximasCount} {proximasCount === 1 ? 'CARTELA PRÓXIMA' : 'CARTELAS PRÓXIMAS'} DO BINGO
              </div>
            </div>
          )}

          {/* PATROCINADORES INDEPENDENTES */}
          <div className="sponsor-list-wrapper">
            {currentSponsors.map((nome, idx) => (
              <div key={`side-${ultimoSorteado}-${idx}-${imgVersion}`} className="sponsor-white-box">
                <img 
                  src={ultimoSorteado ? getImageUrl(ultimoSorteado, idx) : '/sjo.png'} 
                  className="sponsor-img-sidebar" 
                  alt="Sponsor Logo"
                  onError={handleImageError}
                />
                <span className="sponsor-name-sidebar">{nome}</span>
              </div>
            ))}
          </div>
        </aside>

        <main className="grid-area">
          <h1 className="grid-header">NÚMEROS SORTEADOS</h1>
          <div className="grid-container">
            {Array.from({ length: 100 }, (_, i) => i + 1).map(n => (
              <div key={n} className={`cell ${n === ultimoSorteado ? 'ultima' : sorteados.includes(n) ? 'sorteada' : ''}`}>
                {n < 10 ? `0${n}` : n}
              </div>
            ))}
          </div>
        </main>

        {pedraDestaque !== null && !temBingo && (
          <div className="popup-overlay">
            <div className="popup-card">
              <div className="popup-header"><Bell size={32} /> Número Sorteado</div>
              <div className="popup-number">{pedraDestaque < 10 ? `0${pedraDestaque}` : pedraDestaque}</div>
              
              <div className="popup-sponsors-grid">
                {popupSponsors.map((nome, idx) => (
                  <div key={`pop-${pedraDestaque}-${idx}-${imgVersion}`} className="popup-white-box">
                    <img 
                      src={getImageUrl(pedraDestaque, idx)} 
                      className="popup-img-large" 
                      alt="Sponsor Logo"
                      onError={handleImageError}
                    />
                    <div className="popup-name-large">{nome}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {temBingo && (
          <div className="bingo-overlay">
            <div className="bingo-card">
              <Trophy size={140} color="#FFD700" style={{ margin: '0 auto' }} />
              <h1 className="bingo-title">BINGO!</h1>
              <div className="bingo-subtitle">Tabela Preenchida</div>
              <div className="bingo-instruction">LEVAR PARA CONFERÊNCIA</div>
              <div className="bingo-cartelas-list">
                {cartelasBingo.map((b) => (
                  <div key={b.tabela} className="bingo-badge">Cartela {b.tabela}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}