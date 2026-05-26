const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const sequelize = require('../config/database');
const db = {};

// Load all model files recursively
function readModelsRecursively(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      readModelsRecursively(fullPath);
    } else if (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js'
    ) {
      const model = require(fullPath);
      if (model && model.name) {
        db[model.name] = model;
      }
    }
  });
}

readModelsRecursively(__dirname);

// Set up associations
Object.keys(db).forEach(modelName => {
  if (db[modelName] && typeof db[modelName].associate === 'function') {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
