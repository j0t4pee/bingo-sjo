const fs = require('fs');

console.log("Iniciando leitura da planilha do Bingo SJO...");

// Lê o arquivo CSV
const text = fs.readFileSync('bingo.csv', 'utf8');

// Mini robô para ler as colunas corretamente (ignorando vírgulas dentro de textos)
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
    let cell = cells[i];
    
    // Procura pela indicação do Número da Cartela
    if (state === 'SEARCHING') {
        if (/^N[°ºo]/i.test(cell)) {
            let id = parseInt(cells[i+1], 10);
            if (!isNaN(id)) {
                currentCartela = { id, numeros: [] };
                state = 'WAITING_AMIGO';
            }
        }
    } 
    // Espera a letra "O" da palavra AMIGO passar para começar a ler
    else if (state === 'WAITING_AMIGO') {
        if (cell === 'O' || cell === '"O"') {
            state = 'READING_NUMBERS';
            numbersFound = 0;
        }
    } 
    // Lê os 25 números exatos
    else if (state === 'READING_NUMBERS') {
        if (!cell) continue; 
        
        const match = cell.match(/^(\d+)/);
        if (match) {
            const num = parseInt(match[1], 10);
            currentCartela.numeros.push(num);
            numbersFound++;
            
            // Separa o Patrocinador (se houver)
            const sponsorMatch = cell.match(/^\d+\s*(?:-|–)\s*(.*)/);
            if (sponsorMatch) {
                let sponsorName = sponsorMatch[1]
                    .replace(/\n/g, ' ')
                    .replace(/"/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (sponsorName) {
                    patrocinadores[num] = sponsorName;
                }
            }
            
            // Se fechou 25 números, salva a cartela e procura a próxima
            if (numbersFound === 25) {
                cartelas.push(currentCartela);
                state = 'SEARCHING';
            }
        }
    }
}

// Salva os bancos de dados
fs.writeFileSync('cartelas.json', JSON.stringify(cartelas, null, 2));
fs.writeFileSync('patrocinadores.json', JSON.stringify(patrocinadores, null, 2));

console.log(`\n==================================`);
console.log(`🏆 BINGO! MAPEAMENTO CONCLUÍDO!`);
console.log(`==================================`);
console.log(`✅ Cartelas Mapeadas: ${cartelas.length}`);
console.log(`✅ Patrocinadores Encontrados: ${Object.keys(patrocinadores).length}`);
console.log(`\nOs arquivos 'cartelas.json' e 'patrocinadores.json' foram criados!`);