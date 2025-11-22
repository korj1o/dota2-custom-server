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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});