const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Подключение к PostgreSQL с публичным URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(cors());
app.use(express.json());

// Тестовый маршрут
app.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    client.release();
    
    res.json({ 
      message: 'Dota 2 Custom Server is working!',
      database_time: result.rows[0].time,
      status: 'Database connected successfully'
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database connection failed: ' + err.message });
  }
});

// Остальные маршруты остаются такими же...
app.get('/player/:steam_id', async (req, res) => {
  const { steam_id } = req.params;
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM players WHERE steam_id = $1', [steam_id]);
    client.release();

    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        'INSERT INTO players (steam_id, player_name) VALUES ($1, $2) RETURNING *',
        [steam_id, `Player_${steam_id}`]
      );
      res.json(insertResult.rows[0]);
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Failed to fetch player data' });
  }
});

// Простой GET для тестирования установки доната
app.get('/player/:steam_id/setdonate/:coins', async (req, res) => {
  const { steam_id, coins } = req.params;
  
  try {
    const client = await pool.connect();
    const result = await client.query(
      `UPDATE players 
       SET donate_coins = $1, last_seen = CURRENT_TIMESTAMP 
       WHERE steam_id = $2 
       RETURNING *`,
      [parseInt(coins), steam_id]
    );
    client.release();

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Player not found' });
    } else {
      res.json({
        message: 'Donate coins updated successfully!',
        player: result.rows[0]
      });
    }
  } catch (err) {
    console.error('Error updating donate coins:', err);
    res.status(500).json({ error: 'Failed to update donate coins' });
  }
});


app.get('/shop', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Donate Shop</title>
        <style>
          body { font-family: Arial; margin: 20px; background: #1a1a1a; color: white; }
          .item { background: #333; padding: 10px; margin: 5px; border-radius: 5px; }
          .buy-btn { background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; }
          .buy-btn:disabled { background: #666; }
          input { padding: 5px; margin: 5px; }
        </style>
      </head>
      <body>
        <h1>🎮 Donate Shop</h1>
        <div>
          <label>Steam ID: <input type="text" id="steamId" placeholder="Enter Steam ID"></label>
          <button onclick="loadBalance()" style="padding: 5px 10px; background: #2196F3; color: white; border: none; border-radius: 3px;">Load Balance</button>
        </div>
        <div id="balance" style="font-size: 18px; margin: 10px 0;">Balance: --</div>
        <div id="items">
          <div class="item">
            <strong>🌿 Tango</strong> - 10 coins 
            <button class="buy-btn" onclick="buyItem('item_tango', 10)">Buy</button>
          </div>
          <div class="item">
            <strong>💧 Clarity</strong> - 10 coins 
            <button class="buy-btn" onclick="buyItem('item_clarity', 10)">Buy</button>
          </div>
          <div class="item">
            <strong>✨ Faerie Fire</strong> - 10 coins 
            <button class="buy-btn" onclick="buyItem('item_faerie_fire', 10)">Buy</button>
          </div>
          <div class="item">
            <strong>🌳 Iron Branch</strong> - 10 coins 
            <button class="buy-btn" onclick="buyItem('item_branches', 10)">Buy</button>
          </div>
          <div class="item">
            <strong>🔮 Magic Stick</strong> - 20 coins 
            <button class="buy-btn" onclick="buyItem('item_magic_stick', 20)">Buy</button>
          </div>
          <div class="item">
            <strong>❤️ Healing Salve</strong> - 15 coins 
            <button class="buy-btn" onclick="buyItem('item_flask', 15)">Buy</button>
          </div>
          <div class="item">
            <strong>👑 Circlet</strong> - 25 coins 
            <button class="buy-btn" onclick="buyItem('item_circlet', 25)">Buy</button>
          </div>
          <div class="item">
            <strong>👟 Boots of Speed</strong> - 50 coins 
            <button class="buy-btn" onclick="buyItem('item_boots', 50)">Buy</button>
          </div>
        </div>
        <script>
          async function loadBalance() {
            const steamId = document.getElementById('steamId').value;
            if(!steamId) {
              alert('Please enter Steam ID');
              return;
            }
            try {
              const response = await fetch('/player/' + steamId);
              const data = await response.json();
              document.getElementById('balance').textContent = 'Balance: ' + data.donate_coins + ' coins';
              updateButtons(data.donate_coins);
            } catch (error) {
              alert('Error loading balance: ' + error);
            }
          }
          
          async function buyItem(itemName, cost) {
            const steamId = document.getElementById('steamId').value;
            if(!steamId) {
              alert('Please enter Steam ID first');
              return;
            }
            try {
              const currentBalance = parseInt(document.getElementById('balance').textContent.split(': ')[1]);
              if(currentBalance < cost) {
                alert('Not enough coins!');
                return;
              }
              
              const response = await fetch('/player/' + steamId + '/setdonate/' + (currentBalance - cost));
              const data = await response.json();
              if(data.player) {
                document.getElementById('balance').textContent = 'Balance: ' + data.player.donate_coins + ' coins';
                updateButtons(data.player.donate_coins);
                alert('✅ Purchased! New balance: ' + data.player.donate_coins);
              }
            } catch (error) {
              alert('Error purchasing: ' + error);
            }
          }
          
          function updateButtons(balance) {
            const buttons = document.querySelectorAll('.buy-btn');
            buttons.forEach(btn => {
              const cost = parseInt(btn.onclick.toString().match(/buyItem\('[^']+', (\d+)\)/)[1]);
              btn.disabled = balance < cost;
            });
          }
        </script>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});