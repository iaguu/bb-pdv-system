const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3333;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Pizza API funcionando!' });
});

app.listen(PORT, () => {
  console.log('API rodando em: http://localhost:' + PORT);
});
