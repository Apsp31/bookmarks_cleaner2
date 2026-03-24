import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import uploadRouter from './src/routes/upload.js';
import exportRouter from './src/routes/export.js';
import cleanupRouter from './src/routes/cleanup.js';
import mergeRouter from './src/routes/merge.js';
import checkRouter from './src/routes/check.js';
import classifyRouter from './src/routes/classify.js';
import editRouter from './src/routes/edit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend from public/
app.use(express.static(join(__dirname, 'public')));

// Parse JSON request bodies
app.use(express.json());

// API routes
app.use('/api', uploadRouter);
app.use('/api', exportRouter);
app.use('/api', cleanupRouter);
app.use('/api', mergeRouter);
app.use('/api', checkRouter);
app.use('/api', classifyRouter);
app.use('/api', editRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Bookmark Cleaner running at http://localhost:${PORT}`);
});
