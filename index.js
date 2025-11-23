const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL подключение
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Создание таблицы если не существует
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                steam_id VARCHAR(255) UNIQUE NOT NULL,
                player_name VARCHAR(255),
                donate_coins INT DEFAULT 0,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Database initialized');
    } catch (err) {
        console.error('❌ Database init error:', err);
    }
}

// Получить или создать игрока
app.get('/player/:steam_id', async (req, res) => {
    try {
        const { steam_id } = req.params;
        console.log('📥 GET player request:', steam_id);
        
        let result = await pool.query(
            'SELECT * FROM players WHERE steam_id = $1',
            [steam_id]
        );

        if (result.rows.length === 0) {
            console.log('👤 Creating new player:', steam_id);
            result = await pool.query(
                `INSERT INTO players (steam_id, player_name, donate_coins) 
                 VALUES ($1, $2, $3) RETURNING *`,
                [steam_id, `Player_${steam_id}`, 0]
            );
        }

        console.log('✅ Player data sent:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Установить донат-коины
app.get('/player/:steam_id/setdonate/:coins', async (req, res) => {
    try {
        const { steam_id, coins } = req.params;
        const coinsInt = parseInt(coins);
        
        console.log('💰 SET coins request:', steam_id, coinsInt);

        const result = await pool.query(
            'UPDATE players SET donate_coins = $1 WHERE steam_id = $2 RETURNING *',
            [coinsInt, steam_id]
        );

        if (result.rows.length === 0) {
            console.log('❌ Player not found:', steam_id);
            return res.status(404).json({ error: 'Player not found' });
        }

        console.log('✅ Coins updated:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Веб-магазин для админа
app.get('/shop', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Donate Shop Admin</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    padding: 30px;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                }
                h1 { 
                    color: #333; 
                    text-align: center;
                    margin-bottom: 30px;
                }
                .form-group {
                    margin-bottom: 20px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                    color: #555;
                }
                input {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #ddd;
                    border-radius: 8px;
                    font-size: 16px;
                    transition: border-color 0.3s;
                }
                input:focus {
                    outline: none;
                    border-color: #667eea;
                }
                button {
                    width: 100%;
                    padding: 15px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                button:hover {
                    transform: translateY(-2px);
                }
                #result {
                    margin-top: 20px;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                    font-weight: bold;
                }
                .success { 
                    background: #d4edda; 
                    color: #155724; 
                    border: 1px solid #c3e6cb;
                }
                .error { 
                    background: #f8d7da; 
                    color: #721c24; 
                    border: 1px solid #f5c6cb;
                }
                .endpoints {
                    margin-top: 30px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                .endpoints h3 {
                    margin-top: 0;
                    color: #333;
                }
                code {
                    background: #e9ecef;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: 'Courier New', monospace;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎮 Donate Shop Admin Panel</h1>
                
                <form id="donateForm">
                    <div class="form-group">
                        <label for="steamId">Steam ID:</label>
                        <input type="text" id="steamId" placeholder="Enter Steam ID" required>
                    </div>
                    <div class="form-group">
                        <label for="coins">Donate Coins:</label>
                        <input type="number" id="coins" placeholder="Enter coins amount" required>
                    </div>
                    <button type="submit">💰 Set Donate Coins</button>
                </form>
                
                <div id="result"></div>
                
                <div class="endpoints">
                    <h3>📋 API Endpoints:</h3>
                    <p><strong>Get Player:</strong> <code>GET /player/:steam_id</code></p>
                    <p><strong>Set Coins:</strong> <code>GET /player/:steam_id/setdonate/:coins</code></p>
                    <p><strong>Admin Panel:</strong> <code>GET /shop</code></p>
                </div>
            </div>
            
            <script>
                document.getElementById('donateForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const steamId = document.getElementById('steamId').value.trim();
                    const coins = document.getElementById('coins').value.trim();
                    
                    if (!steamId || !coins) {
                        showResult('❌ Please fill all fields', 'error');
                        return;
                    }
                    
                    try {
                        showResult('⏳ Processing...', '');
                        
                        const response = await fetch(\`/player/\${steamId}/setdonate/\${coins}\`);
                        const data = await response.json();
                        
                        if (response.ok) {
                            showResult(\`✅ Success! Player \${data.steam_id} now has \${data.donate_coins} coins\`, 'success');
                        } else {
                            showResult(\`❌ Error: \${data.error}\`, 'error');
                        }
                    } catch (err) {
                        showResult(\`❌ Network Error: \${err.message}\`, 'error');
                    }
                });
                
                function showResult(message, type) {
                    const resultDiv = document.getElementById('result');
                    resultDiv.textContent = message;
                    resultDiv.className = type;
                }
            </script>
        </body>
        </html>
    `);
});

// Health check
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK',
        message: '🎮 Donate Server is running!',
        timestamp: new Date().toISOString(),
        endpoints: {
            get_player: 'GET /player/:steam_id',
            set_coins: 'GET /player/:steam_id/setdonate/:coins',
            admin_shop: 'GET /shop'
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Admin panel: http://localhost:${PORT}/shop`);
    initDB();
});