import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import uploadRouter from './src/routes/upload.js';
import exportRouter from './src/routes/export.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend from public/
app.use(express.static(join(__dirname, 'public')));

// API routes
app.use('/api', uploadRouter);
app.use('/api', exportRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Bookmark Cleaner running at http://localhost:${PORT}`);
});
