import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const demoDir = path.resolve(__dirname, '..', 'demo');
const manifestFile = path.join(demoDir, 'manifest.json');

if (!fs.existsSync(demoDir)) {
  fs.mkdirSync(demoDir, { recursive: true });
}

const files = fs.readdirSync(demoDir).filter(f => f.toLowerCase().endsWith('.threeint'));

const templates = files.map(filename => {
  const baseName = filename.replace(/\.threeint$/i, '');
  const title = baseName
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return {
    file: filename,
    title,
    desc: `Interactive 3D project package (${filename})`
  };
});

fs.writeFileSync(manifestFile, JSON.stringify(templates, null, 2), 'utf8');
console.log(`Discovered ${templates.length} template package(s) in demo/.`);
console.log(`Generated manifest: ${manifestFile}`);
