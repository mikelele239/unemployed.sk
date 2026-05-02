const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

const root = process.cwd();
const dist = path.join(root, 'dist');

console.log('--- Cleaning dist folder ---');
if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive: true, force: true });
}
fs.mkdirSync(dist, { recursive: true });

console.log('--- Copying Landing Page ---');
copyRecursiveSync(path.join(root, 'apps', 'landing'), dist);

console.log('--- Building Student App ---');
execSync('cd apps/student && npm install && npm run build', { stdio: 'inherit' });
const studentDist = path.join(root, 'apps', 'student', 'dist');
copyRecursiveSync(studentDist, path.join(dist, 'app'));

console.log('--- Building Employer App ---');
execSync('cd apps/employer && npm install && npm run build', { stdio: 'inherit' });
const employerDist = path.join(root, 'apps', 'employer', 'dist');
copyRecursiveSync(employerDist, path.join(dist, 'employer'));

console.log('--- Copying Redirects ---');
const redirectsSrc = path.join(root, '_redirects');
if (fs.existsSync(redirectsSrc)) {
  fs.copyFileSync(redirectsSrc, path.join(dist, '_redirects'));
}

console.log('--- Build Complete! ---');
