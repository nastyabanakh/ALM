const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const git = require(path.join(process.env.HOME, '.local/node_modules/isomorphic-git'));
const http = require(path.join(process.env.HOME, '.local/node_modules/isomorphic-git/http/node'));

async function main() {
  const repoDir = process.cwd();
  console.log('Target directory:', repoDir);

  // Get auth token from gh
  const token = execSync(`${process.env.HOME}/.local/bin/gh auth token`).toString().trim();
  console.log('Got GitHub token for user nastyabanakh');

  // Initialize repo if needed
  await git.init({ fs, dir: repoDir, defaultBranch: 'main' });
  console.log('Git repo initialized with default branch: main');

  // Find all files excluding gitignore
  function getFiles(dir, baseDir = dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath);

      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.astro' || entry.name === '.DS_Store') {
        continue;
      }

      if (entry.isDirectory()) {
        files = files.concat(getFiles(fullPath, baseDir));
      } else {
        files.push(relPath);
      }
    }
    return files;
  }

  const allFiles = getFiles(repoDir);
  console.log(`Found ${allFiles.length} files to commit.`);

  console.log('Staging files...');
  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    await git.add({ fs, dir: repoDir, filepath: file });
    if ((i + 1) % 20 === 0 || i === allFiles.length - 1) {
      process.stdout.write(`Staged ${i + 1}/${allFiles.length} files\r`);
    }
  }
  console.log('\nAll files staged successfully.');

  console.log('Creating initial commit...');
  const sha = await git.commit({
    fs,
    dir: repoDir,
    author: {
      name: 'nastyabanakh',
      email: 'nastyabanakh@users.noreply.github.com'
    },
    message: 'Initial commit: ALM Architecture & Construction Website'
  });
  console.log('Committed with SHA:', sha);

  const remoteUrl = 'https://github.com/nastyabanakh/ALM.git';
  console.log(`Pushing to ${remoteUrl} (main branch)...`);

  const pushResult = await git.push({
    fs,
    http,
    dir: repoDir,
    remote: 'origin',
    ref: 'main',
    url: remoteUrl,
    force: true,
    onAuth: () => ({ username: token }),
    onProgress: (progress) => {
      if (progress.phase) {
        process.stdout.write(`Push progress: ${progress.phase} ${progress.loaded || ''}/${progress.total || ''}\r`);
      }
    }
  });

  console.log('\nPush complete! Result:', pushResult);
  console.log('Repository URL: https://github.com/nastyabanakh/ALM');
}

main().catch(err => {
  console.error('\nError during git operations:', err);
  process.exit(1);
});
