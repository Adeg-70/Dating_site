module.exports = {
  apps: [
    {
      name: "loveconnect",
      script: "./server/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      max_memory_restart: "1G",
      watch: false,
      merge_logs: true,
      instance_var: "INSTANCE_ID",
    },
  ],
};
