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
  const model = db[modelName];
  if (!model) return;
  const init = typeof model.associate === 'function'
    ? model.associate
    : typeof model.associations === 'function'
      ? model.associations
      : null;
  if (init) init(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
