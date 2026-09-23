const path = require('path');
const backendDir = path.resolve(__dirname, '../../backend');

module.exports = {
  apps: [
    {
      name: 'farmfresh-api-1',
      script: './server.js',
      cwd: backendDir,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        TRUST_PROXY: '1',
      },
      max_memory_restart: '500M',
      autorestart: true,
    },
    {
      name: 'farmfresh-api-2',
      script: './server.js',
      cwd: backendDir,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        TRUST_PROXY: '1',
      },
      max_memory_restart: '500M',
      autorestart: true,
    },
  ],
};
