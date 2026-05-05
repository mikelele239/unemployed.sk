const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const dist = path.join(root, 'dist');

// Helper to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Clean dist
console.log('Cleaning dist...');
if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// 2. Build Student App
console.log('Building Student App...');
execSync('npm install', { cwd: path.join(root, 'apps', 'student'), stdio: 'inherit' });
execSync('npm run build', { cwd: path.join(root, 'apps', 'student'), stdio: 'inherit' });
copyDir(path.join(root, 'apps', 'student', 'dist'), path.join(dist, 'app'));

// 3. Build Employer App
console.log('Building Employer App...');
execSync('npm install', { cwd: path.join(root, 'apps', 'employer'), stdio: 'inherit' });
execSync('npm run build', { cwd: path.join(root, 'apps', 'employer'), stdio: 'inherit' });
copyDir(path.join(root, 'apps', 'employer', 'dist'), path.join(dist, 'employer'));

// 4. Build Student Demo App
console.log('Building Student Demo App...');
execSync('npm install', { cwd: path.join(root, 'apps', 'student-demo'), stdio: 'inherit' });
execSync('npm run build', { cwd: path.join(root, 'apps', 'student-demo'), stdio: 'inherit' });
copyDir(path.join(root, 'apps', 'student-demo', 'dist'), path.join(dist, 'student-demo'));

// 5. Build Employer Demo App
console.log('Building Employer Demo App...');
execSync('npm install', { cwd: path.join(root, 'apps', 'employer-demo'), stdio: 'inherit' });
execSync('npm run build', { cwd: path.join(root, 'apps', 'employer-demo'), stdio: 'inherit' });
copyDir(path.join(root, 'apps', 'employer-demo', 'dist'), path.join(dist, 'employer-demo'));

// 6. Copy Landing Page
console.log('Copying Landing Page...');
copyDir(path.join(root, 'apps', 'landing'), dist);

// 7. Copy _redirects and _headers
console.log('Copying _redirects and _headers...');
if (fs.existsSync(path.join(root, '_redirects'))) {
  fs.copyFileSync(path.join(root, '_redirects'), path.join(dist, '_redirects'));
}
if (fs.existsSync(path.join(root, '_headers'))) {
  fs.copyFileSync(path.join(root, '_headers'), path.join(dist, '_headers'));
}

console.log('Build complete!');
