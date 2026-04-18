const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'bingo.db'));

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS cartelas (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, numeros TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS sorteio (pedra INTEGER PRIMARY KEY)");
});

module.exports = {
    db,
    salvarCartela: (nome, nums) => {
        return new Promise((res) => {
            db.run("INSERT INTO cartelas (nome, numeros) VALUES (?, ?)", [nome, JSON.stringify(nums)], function() { res(this.lastID); });
        });
    },
    getCartelas: () => {
        return new Promise((res) => {
            db.all("SELECT * FROM cartelas", (err, rows) => res(rows.map(r => ({...r, numeros: JSON.parse(r.numeros)}))));
        });
    }
};