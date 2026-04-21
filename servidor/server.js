const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const uploadDir = path.join(__dirname, '../interface/public/patrocinadores');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 🔥 O SEGREDO ESTÁ AQUI: O Backend agora serve as imagens ao vivo!
app.use('/patrocinadores', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const { numero, index } = req.body;
        cb(null, `${numero}-${parseInt(index) + 1}.png`);
    }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.single('imagem'), (req, res) => {
    console.log(`📸 Nova imagem salva com sucesso para a pedra: ${req.body.numero}`);
    res.json({ success: true });
});

let pedrasSorteadas = [];
let cartelas = [];
let patrocinadores = {};

try {
    const rawData = fs.readFileSync('cartelas.json');
    cartelas = JSON.parse(rawData);
    console.log(`✅ ${cartelas.length} cartelas prontas!`);
} catch (err) { console.error("❌ ERRO: 'cartelas.json' não encontrado."); }

try {
    const patData = fs.readFileSync('patrocinadores.json');
    patrocinadores = JSON.parse(patData);
    console.log(`✅ Patrocinadores carregados localmente!`);
} catch (err) { 
    fs.writeFileSync('patrocinadores.json', JSON.stringify({}));
}

function enviarRanking() {
    let ranking = cartelas.map(cartela => {
        let faltam = cartela.numeros.filter(n => !pedrasSorteadas.includes(n)).length;
        return { tabela: cartela.tabela || cartela.id, faltam: faltam, numeros: cartela.numeros };
    });
    ranking.sort((a, b) => a.faltam - b.faltam);
    io.emit('ranking_update', ranking.slice(0, 50));
}

io.on('connection', (socket) => {
    socket.emit('init', { pedrasSorteadas, patrocinadores });
    enviarRanking(); 

    socket.on('salvar_patrocinadores', (novos) => {
        patrocinadores = novos;
        fs.writeFileSync('patrocinadores.json', JSON.stringify(patrocinadores, null, 2));
        io.emit('patrocinadores_atualizados', patrocinadores);
    });

    socket.on('sortear_pedra', (num) => {
        if (!pedrasSorteadas.includes(num)) {
            pedrasSorteadas.push(num);
            io.emit('pedra_sorteada', num);
            
            let alertas = [];
            cartelas.forEach(cartela => {
                let faltam = cartela.numeros.filter(n => !pedrasSorteadas.includes(n)).length;
                if (faltam <= 1) alertas.push({ tabela: cartela.tabela || cartela.id, nome: cartela.nome || "Jogador", faltam: faltam, bingo: faltam === 0 });
            });
            if (alertas.length > 0) io.emit('alerta_proximidade', alertas);
            enviarRanking();
        }
    });

    socket.on('buscar_cartela', (idBuscado) => {
        const cartela = cartelas.find(c => c.tabela == idBuscado || c.id == idBuscado);
        if (cartela) socket.emit('retorno_cartela', { id: cartela.tabela || cartela.id, numeros: cartela.numeros });
        else socket.emit('retorno_cartela', null);
    });

    socket.on('resetar', () => {
        pedrasSorteadas = [];
        io.emit('reseta_jogo');
        enviarRanking(); 
    });
});

server.listen(5001, () => { console.log(`🚀 Servidor LOCAL rodando na porta 5001 com Upload Automático!`); });