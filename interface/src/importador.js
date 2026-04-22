const fs = require('fs');

console.log("Iniciando leitura blindada da planilha do Bingo SJO...");

try {
    const text = fs.readFileSync('bingo.csv', 'utf8');

    const cells = [];
    let current = '';
    let inQuotes = false;
    for(let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';' || char === '\n' || char === '\r') && !inQuotes) {
            cells.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    cells.push(current.trim());

    const cartelas = [];
    const patrocinadores = {};

    let state = 'SEARCHING';
    let currentCartela = null;
    let numbersFound = 0;

    for(let i = 0; i < cells.length; i++) {
        // MÁGICA NOVA: Tira todas as aspas e espaços invisíveis antes de ler!
        let cell = cells[i].replace(/"/g, '').trim(); 
        
        if (state === 'SEARCHING') {
            if (/^N[°ºo]/i.test(cell)) {
                let id = parseInt(cells[i+1].replace(/"/g, '').trim(), 10);
                if (!isNaN(id)) {
                    currentCartela = { id, numeros: [] };
                    state = 'WAITING_AMIGO';
                }
            }
        } 
        else if (state === 'WAITING_AMIGO') {
            if (cell === 'O') {
                state = 'READING_NUMBERS';
                numbersFound = 0;
            }
        } 
        else if (state === 'READING_NUMBERS') {
            if (!cell) continue; 
            
            const match = cell.match(/^(\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                currentCartela.numeros.push(num);
                numbersFound++;
                
                // Pega o patrocinador ignorando sujeiras
                const sponsorMatch = cell.match(/^\d+\s*(?:-|–)\s*(.*)/);
                if (sponsorMatch) {
                    let sponsorName = sponsorMatch[1].trim();
                    if (sponsorName) {
                        patrocinadores[num] = sponsorName;
                    }
                }
                
                if (numbersFound === 25) {
                    cartelas.push(currentCartela);
                    state = 'SEARCHING';
                }
            }
        }
    }

    fs.writeFileSync('cartelas.json', JSON.stringify(cartelas, null, 2));
    fs.writeFileSync('patrocinadores.json', JSON.stringify(patrocinadores, null, 2));

    console.log(`✅ Cartelas Mapeadas: ${cartelas.length}`);
    console.log(`✅ Patrocinadores: ${Object.keys(patrocinadores).length} encontrados!`);

} catch (erro) {
    console.error("\n❌ ERRO: Arquivo bingo.csv não encontrado.");
}