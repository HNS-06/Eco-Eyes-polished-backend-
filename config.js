module.exports = {
  USE_DB: false,
  PORT: process.env.PORT || 4000,
  DB_URI: process.env.DB_URI || 'mongodb://localhost:27017/echoeyes'
};
