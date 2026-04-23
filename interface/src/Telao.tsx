import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:5001';
const socket: Socket = io(BACKEND_URL);

export default function Telao() {
  useEffect(() => {
    const travaAba = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', travaAba);
    return () => window.removeEventListener('beforeunload', travaAba);
  }, []);

  const [sorteados, setSorteados] = useState<number[]>([]);
  const [pedraDestaque, setPedraDestaque] = useState<number | null>(null);
  const [patrocinadoresBase, setPatrocinadoresBase] = useState<Record<string, string | string[]>>({});
  
  const [imgVersion, setImgVersion] = useState<number>(Date.now());
  const [imgErrorMap, setImgErrorMap] = useState<Record<string, boolean>>({});
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

    socket.on('update_sorteados', (lista: number[]) => {
      setSorteados(lista);
    });
    
    socket.on('pedra_sorteada', (n: number) => {
      setPedraDestaque(n); 
      const tempoSegundos = Number(localStorage.getItem('popupDuration') || 6);
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = setTimeout(() => setPedraDestaque(null), tempoSegundos * 1000);
    });

    socket.on('reseta_jogo', () => { setPedraDestaque(null); });

    return () => { socket.off(); };
  }, []);

  const ultimoSorteado = sorteados[sorteados.length - 1] || null;

  // CORREÇÃO AQUI: Se não tiver dado, retorna Array Vazia (Não exibe texto genérico)
  const getSponsorsList = (num: number | null) => {
    if (!num) return [];
    const numString = num.toString();
    const numComZero = num < 10 ? `0${num}` : numString;
    const data = patrocinadoresBase[numString] || patrocinadoresBase[numComZero];
    if (!data) return []; 
    return Array.isArray(data) ? data : [data];
  };

  const currentSponsors = getSponsorsList(ultimoSorteado);
  const popupSponsors = getSponsorsList(pedraDestaque);

  const getImageUrl = (num: number, idx: number) => {
    return `${BACKEND_URL}/patrocinadores/${num}-${idx + 1}.png?v=${imgVersion}`;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Montserrat', sans-serif; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #FFD700; border-radius: 4px; }
        
        .telao-bg { display: flex; height: 100vh; width: 100vw; background: #0a0a0a; color: #ffffff; padding: 25px; gap: 25px; overflow: hidden; }
        .sidebar { width: 32%; display: flex; flex-direction: column; gap: 20px; }
        .top-stats { display: flex; gap: 15px; flex-shrink: 0; }
        .stat-box { flex: 1; background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 15px; text-align: center; }
        .stat-label { font-size: 12px; color: #a3a3a3; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; display: block; }
        .stat-num { font-size: 36px; font-weight: 700; color: #ffffff; }
        
        .gold-box { background: #FFD700; border-radius: 16px; padding: 25px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; flex-shrink: 0; box-shadow: 0 8px 25px rgba(255, 215, 0, 0.15); }
        .gold-label { font-size: 24px; color: #523b08; font-weight: 700; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
        .gold-number { font-size: 140px; font-weight: 800; color: #000000; line-height: 0.85; margin-bottom: 0px;}
        
        .grid-area { flex: 1; background: #141414; border-radius: 16px; padding: 30px; border: 1px solid #262626; display: flex; flex-direction: column; }
        .grid-header { font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 25px; color: #e5e5e5; text-transform: uppercase; letter-spacing: 1px; }
        .grid-container { display: grid; grid-template-columns: repeat(10, 1fr); gap: 12px; height: 100%; }
        .cell { display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 700; color: #333; background: #0a0a0a; border-radius: 8px; border: 1px solid #1a1a1a; transition: 0.3s; }
        .cell.sorteada { color: #FFD700; background: #1c190a; border-color: #423b12; }
        .cell.ultima { background: #FFD700; color: #000; transform: scale(1.1); box-shadow: 0 0 25px rgba(255, 215, 0, 0.4); border: none; z-index: 10; }
        
        .sponsor-list-wrapper { display: flex; flex-direction: column; gap: 15px; width: 100%; align-items: stretch; overflow-y: auto; flex: 1; padding-right: 5px; }
        .sponsor-card { border-radius: 16px; flex: 1; min-width: 280px; display: flex; position: relative; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: all 0.4s ease; }

        .default-mode { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.1); align-items: center; justify-content: center; padding: 20px 30px; gap: 20px; }
        .default-mode::before { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,215,0,0.05) 0%, transparent 100%); z-index: 0; }
        .bg-watermark { position: absolute; inset: -20%; background: url('/sjo.png') no-repeat center center; background-size: 50%; opacity: 0.06; filter: grayscale(100%) blur(2px); z-index: 0; transform: rotate(-10deg); }
        .fixed-brasao { height: 60px; object-fit: contain; filter: drop-shadow(0 0 10px rgba(0,0,0,0.3)); position: relative; z-index: 2; transition: all 0.3s ease; }
        .default-mode .sponsor-name { position: relative; z-index: 2; color: #ffffff; font-weight: 700; text-transform: uppercase; text-align: left; text-shadow: 0 2px 8px rgba(0,0,0,0.6); line-height: 1.2; transition: all 0.3s ease; }
        
        .sponsor-card.sidebar-size { flex: 0 1 auto; width: 100%; justify-content: flex-start; } 
        .sponsor-card.sidebar-size:only-child { min-height: 220px; justify-content: center; }
        
        .default-mode.sidebar-size .sponsor-name { font-size: 15px; }
        .default-mode.sidebar-size .fixed-brasao { height: 45px; }
        
        .default-mode.popup-size { flex: 0 1 100%; max-width: 450px; min-height: 160px; padding: 30px 40px; gap: 25px; justify-content: center; text-align: center; }
        .default-mode.popup-size .sponsor-name { font-size: 30px; text-align: center; }
        .default-mode.popup-size .fixed-brasao { height: 70px; }
        
        .default-mode.popup-size:only-child { max-width: 600px; min-height: 250px; }
        .default-mode.popup-size:only-child .sponsor-name { font-size: 34px; }
        .default-mode.popup-size:only-child .fixed-brasao { height: 110px; }

        .custom-mode { background: #111; border: 1px solid rgba(255,255,255,0.05); flex-direction: column; align-items: center; justify-content: center; }
        .img-glow-backdrop { position: absolute; inset: -10%; background-size: cover; background-position: center; filter: blur(35px) brightness(0.6); opacity: 0.7; z-index: 0; }
        .custom-mode img, .custom-mode .sponsor-name { position: relative; z-index: 1; transition: all 0.3s ease; }
        .custom-mode img { object-fit: contain; border-radius: 8px; }
        .custom-mode .sponsor-name { color: #ffffff; font-weight: 700; text-transform: uppercase; text-align: center; text-shadow: 0 2px 8px rgba(0,0,0,0.8); line-height: 1.2; }
        
        .custom-mode.sidebar-size { padding: 15px; gap: 12px; } 
        .custom-mode.sidebar-size img { max-height: 80px; max-width: 100%; }
        .custom-mode.sidebar-size .sponsor-name { font-size: 14px; }
        
        .custom-mode.sidebar-size:only-child img { max-height: 110px; }
        .custom-mode.sidebar-size:only-child .sponsor-name { font-size: 18px; }
        
        .custom-mode.popup-size { flex: 0 1 100%; max-width: 450px; min-height: 160px; padding: 25px 35px; gap: 15px; }
        .custom-mode.popup-size img { max-height: 160px; max-width: 100%; border-radius: 10px; }
        .custom-mode.popup-size .sponsor-name { font-size: 22px; }

        .custom-mode.popup-size:only-child { max-width: 600px; min-height: 250px; }
        .custom-mode.popup-size:only-child img { max-height: 280px; }
        .custom-mode.popup-size:only-child .sponsor-name { font-size: 34px; }

        .popup-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.92); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 500; }
        .popup-card { text-align: center; width: 100%; max-width: 95%; margin: 0 auto; animation: epicPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .popup-header { font-size: 28px; color: #FFD700; font-weight: 700; text-transform: uppercase; margin-bottom: 15px; letter-spacing: 2px; }
        .popup-number { font-size: 280px; font-weight: 800; color: #ffffff; line-height: 1; margin-bottom: 30px; text-shadow: 0 5px 25px rgba(0,0,0,0.4); }
        
        .popup-sponsors-grid { display: flex; flex-direction: row; justify-content: center; align-items: stretch; gap: 20px; flex-wrap: wrap; padding: 0 20px; width: 100%; }
        
        @keyframes epicPop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      <div className="telao-bg">
        <aside className="sidebar">
          <div className="top-stats">
            <div className="stat-box"><span className="stat-label">Sorteados</span><span className="stat-num">{sorteados.length}</span></div>
            <div className="stat-box"><span className="stat-label">Restantes</span><span className="stat-num">{100 - sorteados.length}</span></div>
          </div>

          <div className="gold-box">
            <div className="gold-label">Último Número</div>
            <div className="gold-number">
              {ultimoSorteado ? (ultimoSorteado < 10 ? `0${ultimoSorteado}` : ultimoSorteado) : '--'}
            </div>
          </div>

          <div className="sponsor-list-wrapper">
            {currentSponsors.map((nome, idx) => {
              const key = `side-${ultimoSorteado}-${idx}-${imgVersion}`;
              const imgUrl = ultimoSorteado ? getImageUrl(ultimoSorteado, idx) : '';
              const isError = imgErrorMap[key];

              return isError || !ultimoSorteado ? (
                <div key={key} className="sponsor-card default-mode sidebar-size">
                  <div className="bg-watermark"></div>
                  <img src="/sjo.png" className="fixed-brasao" alt="Brasão" />
                  <span className="sponsor-name">{nome}</span>
                </div>
              ) : (
                <div key={key} className="sponsor-card custom-mode sidebar-size">
                  <div className="img-glow-backdrop" style={{ backgroundImage: `url(${imgUrl})` }}></div>
                  <img src={imgUrl} onError={() => setImgErrorMap(prev => ({...prev, [key]: true}))} alt="Sponsor Logo" />
                  <span className="sponsor-name">{nome}</span>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="grid-area">
          <h1 className="grid-header">Números Sorteados</h1>
          <div className="grid-container">
            {Array.from({ length: 100 }, (_, i) => i + 1).map(n => (
              <div key={n} className={`cell ${n === ultimoSorteado ? 'ultima' : sorteados.includes(n) ? 'sorteada' : ''}`}>
                {n < 10 ? `0${n}` : n}
              </div>
            ))}
          </div>
        </main>

        {pedraDestaque !== null && (
          <div className="popup-overlay">
            <div className="popup-card">
              <div className="popup-header">Número Sorteado</div>
              <div className="popup-number">{pedraDestaque < 10 ? `0${pedraDestaque}` : pedraDestaque}</div>
              
              {/* O GRID DE PATROCINADORES SÓ APARECE SE A PEDRA TIVER ALGO CADASTRADO */}
              {popupSponsors.length > 0 && (
                <div className="popup-sponsors-grid">
                  {popupSponsors.map((nome, idx) => {
                    const key = `pop-${pedraDestaque}-${idx}-${imgVersion}`;
                    const imgUrl = getImageUrl(pedraDestaque, idx);
                    const isError = imgErrorMap[key];

                    return isError ? (
                      <div key={key} className="sponsor-card default-mode popup-size">
                        <div className="bg-watermark"></div>
                        <img src="/sjo.png" className="fixed-brasao" alt="Brasão" />
                        <span className="sponsor-name">{nome}</span>
                      </div>
                    ) : (
                      <div key={key} className="sponsor-card custom-mode popup-size">
                        <div className="img-glow-backdrop" style={{ backgroundImage: `url(${imgUrl})` }}></div>
                        <img src={imgUrl} onError={() => setImgErrorMap(prev => ({...prev, [key]: true}))} alt="Sponsor Logo" />
                        <span className="sponsor-name">{nome}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}