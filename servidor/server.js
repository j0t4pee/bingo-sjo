const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dbHelper = require('./database/db'); 

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] }
});

let pedrasSorteadas = [];
let cartelas = [];

async function carregarDados() {
    try {
        cartelas = await dbHelper.getCartelas();
        dbHelper.db.all("SELECT pedra FROM sorteio", (err, rows) => {
            if(!err && rows) pedrasSorteadas = rows.map(r => r.pedra);
            console.log(`🧠 Backend Pronto: ${cartelas.length} cartelas | ${pedrasSorteadas.length} pedras.`);
        });
    } catch (err) { console.error("Erro no banco:", err); }
}
carregarDados();

function verificarProximidade(lista, sorteados) {
    let alertas = [];
    lista.forEach(cartela => {
        let marcados = 0;
        cartela.numeros.forEach(num => {
            if (sorteados.includes(num)) marcados++;
        });
        let faltam = cartela.numeros.length - marcados;
        if (faltam <= 5 && faltam > 0) {
            alertas.push({ tabela: cartela.id, nome: cartela.nome, faltam: faltam });
        } else if (faltam === 0) {
            alertas.push({ tabela: cartela.id, nome: cartela.nome, faltam: 0, bingo: true });
        }
    });
    // Ordena para mostrar quem falta menos primeiro
    return alertas.sort((a, b) => a.faltam - b.faltam);
}

io.on('connection', async (socket) => {
    socket.emit('init', { pedrasSorteadas, cartelas });
    
    // Envia alertas iniciais (F5 amigável)
    if(pedrasSorteadas.length > 0) {
        socket.emit('alerta_proximidade', verificarProximidade(cartelas, pedrasSorteadas));
    }

    socket.on('sortear', (num) => {
        if (!pedrasSorteadas.includes(num)) {
            pedrasSorteadas.push(num);
            dbHelper.db.run("INSERT INTO sorteio (pedra) VALUES (?)", [num]);
            io.emit('pedra_sorteada', num);
            
            // Roda a conferência e avisa a todos
            const alertas = verificarProximidade(cartelas, pedrasSorteadas);
            io.emit('alerta_proximidade', alertas);
        }
    });

    socket.on('registrar_cartela', async (dados) => {
        const id = await dbHelper.salvarCartela(dados.nome, dados.numeros);
        const listaAtualizada = await dbHelper.getCartelas();
        cartelas = listaAtualizada;
        io.emit('lista_cartelas', listaAtualizada);
    });

    socket.on('excluir_cartela', (id) => {
        cartelas = cartelas.filter(c => c.id !== id);
        dbHelper.db.run("DELETE FROM cartelas WHERE id = ?", [id]);
        io.emit('lista_cartelas', cartelas);
    });

    socket.on('limpar_jogo', () => {
        pedrasSorteadas = [];
        dbHelper.db.run("DELETE FROM sorteio");
        io.emit('init', { pedrasSorteadas: [], cartelas: [] });
    });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`🧠 Servidor rodando na ${PORT}`));