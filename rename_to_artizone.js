import fs from 'fs';

// 1. Update index.html
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(/<title>KalaSetu — Handmade by India's artisans<\/title>/g, '<title>ARTIZONE — Handmade by India\'s artisans</title>');
html = html.replace(/Log in to KalaSetu/g, 'Log in to ARTIZONE');
html = html.replace(/aria-label="KalaSetu home"/g, 'aria-label="ARTIZONE home"');
html = html.replace(/<span className="brand-name" style=\{\{ display:'block' \}\}>KalaSetu<\/span>/g, '<span className="brand-name" style={{ display:\'block\', letterSpacing:\'0.5px\' }}>ARTIZONE</span>');
html = html.replace(/KalaSetu\u2019s AI Studio Photography Pipeline/g, 'ARTIZONE\u2019s AI Studio Photography Pipeline');
html = html.replace(/KalaSetu's AI Studio Photography Pipeline/g, 'ARTIZONE\'s AI Studio Photography Pipeline');
html = html.replace(/<div className="brand-name" style=\{\{ color:'#fff', fontSize:22 \}\}>KalaSetu<\/div>/g, '<div className="brand-name" style={{ color:\'#fff\', fontSize:22, letterSpacing:\'0.5px\' }}>ARTIZONE</div>');
html = html.replace(/Sell on KalaSetu/g, 'Sell on ARTIZONE');
html = html.replace(/Live Marketplace Listing Preview · KalaSetu/g, 'Live Marketplace Listing Preview · ARTIZONE');
html = html.replace(/KalaSetu keeps 8%/g, 'ARTIZONE keeps 8%');
html = html.replace(/buying patterns on KalaSetu/g, 'buying patterns on ARTIZONE');
html = html.replace(/kalasetu-backend/g, 'artizone-backend');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Updated index.html branding to ARTIZONE');

// 2. Update server.js
let server = fs.readFileSync('server.js', 'utf8');
server = server.replace(/KalaSetu backend listening/g, 'ARTIZONE backend listening');
server = server.replace(/KalaSetu — artisan market linkage platform\.html/g, 'ARTIZONE — artisan market linkage platform.html');
fs.writeFileSync('server.js', server, 'utf8');
console.log('Updated server.js');

// 3. Update package.json
let pkg = fs.readFileSync('package.json', 'utf8');
pkg = pkg.replace(/"kalasetu-backend"/g, '"artizone-backend"');
pkg = pkg.replace(/KalaSetu/g, 'ARTIZONE');
fs.writeFileSync('package.json', pkg, 'utf8');
console.log('Updated package.json');

// 4. Update README.md
if (fs.existsSync('README.md')) {
  let readme = fs.readFileSync('README.md', 'utf8');
  readme = readme.replace(/KalaSetu/g, 'ARTIZONE');
  readme = readme.replace(/kalasetu/g, 'artizone');
  fs.writeFileSync('README.md', readme, 'utf8');
  console.log('Updated README.md');
}
