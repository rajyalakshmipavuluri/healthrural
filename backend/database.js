const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const ensureFile = (filename) => {
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([]));
  }
  return filePath;
};

// Initialize DB files
const files = {
  users: ensureFile('users.json'),
  articles: ensureFile('articles.json'),
  tips: ensureFile('tips.json'),
  consultations: ensureFile('consultations.json'),
  appointments: ensureFile('appointments.json')
};

const DB = {
  read: (table) => {
    try {
      const data = fs.readFileSync(files[table]);
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  },
  write: (table, data) => {
    fs.writeFileSync(files[table], JSON.stringify(data, null, 2));
  },
  insert: (table, item) => {
    item._id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    item.createdAt = new Date().toISOString();
    const data = DB.read(table);
    data.push(item);
    DB.write(table, data);
    return item;
  },
  update: (table, id, updates) => {
    const data = DB.read(table);
    const index = data.findIndex(item => item._id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...updates };
      DB.write(table, data);
      return data[index];
    }
    return null;
  },
  findById: (table, id) => {
    const data = DB.read(table);
    return data.find(item => item._id === id);
  },
  find: (table, queryFn) => {
    const data = DB.read(table);
    if (!queryFn) return data;
    return data.filter(queryFn);
  },
  findOne: (table, queryFn) => {
    const data = DB.read(table);
    return data.find(queryFn);
  }
};

module.exports = DB;
