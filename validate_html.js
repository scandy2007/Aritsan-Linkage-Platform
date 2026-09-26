import fs from 'fs';
import https from 'https';

const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);

if (!match) {
  console.error('ERROR: No <script type="text/babel"> tag found in index.html!');
  process.exit(1);
}

const code = match[1];
console.log('Babel script extracted. Total lines in Babel block:', code.split('\n').length);

// Fetch babel standalone to test compilation exactly like the browser does
https.get('https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Run babel standalone in VM
    import('vm').then(vm => {
      const sandbox = { console, window: {}, Babel: {} };
      vm.createContext(sandbox);
      vm.runInContext(data + '; window.Babel = Babel;', sandbox);
      
      try {
        const transformed = sandbox.Babel.transform(code, { presets: ['react'] });
        console.log('✅ Babel compilation SUCCESS! Code length:', transformed.code.length);
      } catch (err) {
        console.error('❌ SYNTAX ERROR FOUND in index.html JSX:');
        console.error(err.message);
        if (err.loc) {
          console.error(`Error at line ${err.loc.line}, column ${err.loc.column}`);
          const lines = code.split('\n');
          console.error('\n--- Surrounding code ---');
          for (let i = Math.max(0, err.loc.line - 10); i < Math.min(lines.length, err.loc.line + 10); i++) {
            const prefix = (i + 1 === err.loc.line) ? ' -> ' : '    ';
            console.error(`${prefix}${i + 1}: ${lines[i]}`);
          }
        }
      }
    });
  });
}).on('error', err => {
  console.error('Network error fetching babel:', err);
});
