import fs from 'fs';

// 1. Update index.html
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/KalaSetu\u2019s AI Studio Photography Pipeline/g, 'ARTIZONE\u2019s AI Studio Photography Pipeline');
html = html.replace(/KalaSetu's AI Studio Photography Pipeline/g, 'ARTIZONE\'s AI Studio Photography Pipeline');
html = html.replace(/KalaSetu — design tokens/g, 'ARTIZONE — design tokens');
html = html.replace(/'kalasetu\.v1'/g, '\'artizone.v1\'');

fs.writeFileSync('index.html', html, 'utf8');
fs.writeFileSync('ARTIZONE — artisan market linkage platform.html', html, 'utf8');
console.log('Synchronized index.html and ARTIZONE html file.');

// 2. Update server.js
let server = fs.readFileSync('server.js', 'utf8');
server = server.replace(
  /app\.get\('\/', \(req, res\) => {[\s\S]*?}\);/,
  `app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.resolve('./index.html'));
});`
);
fs.writeFileSync('server.js', server, 'utf8');
console.log('Updated server.js root route with no-cache headers.');
