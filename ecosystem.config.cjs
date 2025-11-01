
module.exports = {
  apps: [{
    name: "gematriajourney",
    script: "server/index.js",
    env: {
      NODE_ENV: "production",
      PORT: "4002"
    }
  }]
}
