import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import App from './App';       // Este é o seu Painel Admin
import Telao from './Telao';   // Este é o seu Telão do Público

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Rota principal: http://localhost:3000 */}
        <Route path="/" element={<App />} />
        
        {/* Rota do Telão: http://localhost:3000/telao */}
        <Route path="/telao" element={<Telao />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);