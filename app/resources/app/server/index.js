import express from 'express';
import cors from 'cors';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { extensionsRouter } from './routes/extensions.js';
import { securityRouter } from './routes/security.js';

const app = express();
const PORT = process.env.PORT || '3001';

app.use(cors());
app.use(express.json());
app.use('/api/extensions', extensionsRouter);
app.use('/api/security', securityRouter);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'client', 'dist');

// Inject CSP meta into index.html
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    const htmlPath = path.join(distDir, 'index.html');
    let html = readFileSync(htmlPath, 'utf-8');
    const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' http://localhost:3001; script-src \'self\'; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src \'self\' https://fonts.gstatic.com https://fonts.gstatic.font.im; img-src \'self\' data:; connect-src \'self\' http://localhost:3001 ws://localhost:3001;">';
    html = html.replace('<head>', '<head>' + csp);
    return res.type('html').send(html);
  }
  next();
});

app.use(express.static(distDir));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => console.log('Server on http://localhost:' + PORT));
export default app;
