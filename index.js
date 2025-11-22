// Импортируем необходимые библиотеки
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

// Создаем экземпляр приложения Express
const app = express();
const PORT = process.env.PORT || 3000;

// Создаем пул подключений к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Подключаем middleware
app.use(cors());
app.use(express.json());

// Тестовый маршрут для проверки подключения к БД
app.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    res.json({ 
      message: 'Dota 2 Custom Server is working!',
      database_time: result.rows[0].current_time,
      status: 'Database connected successfully'
    });
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Маршрут для получения информации об игроке по Steam ID
app.get('/player/:steam_id', async (req, res) => {
  const { steam_id } = req.params;

  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT * FROM players WHERE steam_id = $1',
      [steam_id]
    );
    client.release();

    if (result.rows.length === 0) {
      // Если игрок не найден, создаем нового
      const insertResult = await pool.query(
        'INSERT INTO players (steam_id, player_name) VALUES ($1, $2) RETURNING *',
        [steam_id, `Player_${steam_id}`]
      );
      res.json(insertResult.rows[0]);
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Error fetching player:', err);
    res.status(500).json({ error: 'Failed to fetch player data' });
  }
});

// Маршрут для обновления Donate coins игрока
app.patch('/player/:steam_id/donate', async (req, res) => {
  const { steam_id } = req.params;
  const { coins } = req.body;

  if (typeof coins !== 'number') {
    return res.status(400).json({ error: 'Coins must be a number' });
  }

  try {
    const client = await pool.connect();
    const result = await client.query(
      `UPDATE players 
       SET donate_coins = $1, last_seen = CURRENT_TIMESTAMP 
       WHERE steam_id = $2 
       RETURNING *`,
      [coins, steam_id]
    );
    client.release();

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Player not found' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Error updating donate coins:', err);
    res.status(500).json({ error: 'Failed to update donate coins' });
  }
});

// Запускаем сервер
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});