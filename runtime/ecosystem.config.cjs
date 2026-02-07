module.exports = {
  apps: [
    {
      name: 'bf-runtime',
      script: 'dist/index.js',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '256M',
      restart_delay: 5000,
      max_restarts: 10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
