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
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const uploadDir = path.join(__dirname, '../interface/public/patrocinadores');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
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
let rastreioConfig = { todas: true, lista: [] };

try { cartelas = JSON.parse(fs.readFileSync('cartelas.json')); console.log(`✅ ${cartelas.length} cartelas prontas!`); } catch (err) {}
try { patrocinadores = JSON.parse(fs.readFileSync('patrocinadores.json')); } catch (err) { fs.writeFileSync('patrocinadores.json', JSON.stringify({})); }
try { rastreioConfig = JSON.parse(fs.readFileSync('rastreio.json')); } catch (err) { fs.writeFileSync('rastreio.json', JSON.stringify(rastreioConfig)); }

function enviarRanking() {
    let rankingData = [];
    if (rastreioConfig.todas) {
        let ranking = cartelas.map(c => ({ tabela: c.tabela || c.id, faltam: c.numeros.filter(n => !pedrasSorteadas.includes(n)).length, numeros: c.numeros }));
        ranking.sort((a, b) => a.faltam - b.faltam);
        rankingData = ranking.slice(0, 50);
    } else {
        let selecionadas = cartelas.filter(c => rastreioConfig.lista.includes(c.tabela?.toString()) || rastreioConfig.lista.includes(c.id?.toString()));
        rankingData = selecionadas.map(c => ({ tabela: c.tabela || c.id, faltam: c.numeros.filter(n => !pedrasSorteadas.includes(n)).length, numeros: c.numeros }));
        rankingData.sort((a, b) => a.faltam - b.faltam);
    }
    io.emit('ranking_update', rankingData);
}

function atualizarAlertas() {
    let alertas = [];
    cartelas.forEach(cartela => {
        let faltam = cartela.numeros.filter(n => !pedrasSorteadas.includes(n)).length;
        if (faltam <= 1) alertas.push({ tabela: cartela.tabela || cartela.id, nome: cartela.nome || "Jogador", faltam: faltam, bingo: faltam === 0 });
    });
    io.emit('alerta_proximidade', alertas);
}

io.on('connection', (socket) => {
    socket.emit('init', { pedrasSorteadas, patrocinadores, rastreioConfig });
    enviarRanking(); 

    socket.on('salvar_patrocinadores', (novos) => {
        patrocinadores = novos;
        fs.writeFileSync('patrocinadores.json', JSON.stringify(patrocinadores, null, 2));
        io.emit('patrocinadores_atualizados', patrocinadores);
    });

    // NOVO: DELETAR APENAS A IMAGEM
    socket.on('remover_imagem_patrocinador', ({ numero, index }) => {
        const filepath = path.join(uploadDir, `${numero}-${parseInt(index) + 1}.png`);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            console.log(`🗑️ Imagem da pedra ${numero} removida (Voltando ao Brasão).`);
        }
        io.emit('patrocinadores_atualizados', patrocinadores);
    });

    // NOVO: GERAR RELATÓRIO
    socket.on('pedir_relatorio', () => {
        let relatorioPatros = [];
        for (const [num, nomes] of Object.entries(patrocinadores)) {
            const listaNomes = Array.isArray(nomes) ? nomes : [nomes];
            listaNomes.forEach((nome, idx) => {
                const filepath = path.join(uploadDir, `${num}-${idx + 1}.png`);
                const temImagem = fs.existsSync(filepath);
                relatorioPatros.push({
                    pedra: num,
                    nome: nome,
                    statusImagem: temImagem ? 'Imagem Personalizada' : 'Imagem Brasão da Paróquia'
                });
            });
        }
        socket.emit('retorno_relatorio', { sorteados: pedrasSorteadas, patrocinadores: relatorioPatros });
    });

    socket.on('configurar_rastreio', (config) => {
        rastreioConfig = config;
        fs.writeFileSync('rastreio.json', JSON.stringify(rastreioConfig, null, 2));
        enviarRanking();
    });

    socket.on('sortear_pedra', (num) => {
        if (!pedrasSorteadas.includes(num)) {
            pedrasSorteadas.push(num);
            io.emit('pedra_sorteada', num);
            atualizarAlertas();
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

server.listen(5001, () => { console.log(`🚀 Servidor LOCAL rodando com Relatórios e Edição Inteligente!`); });