const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const DB = require('./database');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey12345';

const sendResponse = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
};

const sendError = (res, statusCode, message) => {
  sendResponse(res, statusCode, { message });
};

// Middleware: Parse JSON body
const parseBody = (req) => {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
  });
};

// Middleware: Check Auth
const protect = (req, res) => {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = DB.findById('users', decoded.id);
        if (user) {
          req.user = user;
          return resolve(true);
        }
      } catch (error) {
        // Token invalid
      }
    }
    sendError(res, 401, 'Not authorized');
    resolve(false);
  });
};

// Extract route params
const matchRoute = (reqUrl, routePattern) => {
  const urlParts = reqUrl.split('/');
  const routeParts = routePattern.split('/');
  if (urlParts.length !== routeParts.length) return null;
  const params = {};
  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i].startsWith(':')) {
      params[routeParts[i].substring(1)] = urlParts[i];
    } else if (routeParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
};

// Create Server
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS, POST, GET, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const url = req.url.split('?')[0];

  // --- Auth Routes ---
  if (url === '/api/auth/register' && req.method === 'POST') {
    const body = await parseBody(req);
    const { name, email, password, role } = body;
    
    if (DB.findOne('users', u => u.email === email)) {
      return sendError(res, 400, 'User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = DB.insert('users', {
      name, email, password: hashedPassword, role: role || 'user'
    });

    return sendResponse(res, 201, {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' })
    });
  }

  if (url === '/api/auth/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const { email, password } = body;
    
    const user = DB.findOne('users', u => u.email === email);
    if (user && await bcrypt.compare(password, user.password)) {
      return sendResponse(res, 200, {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' })
      });
    } else {
      return sendError(res, 401, 'Invalid email or password');
    }
  }

  // --- Content Routes ---
  if (url === '/api/content/articles' && req.method === 'GET') {
    const articles = DB.read('articles');
    // Populate author
    const populated = articles.map(a => {
      const author = DB.findById('users', a.author);
      return { ...a, author: author ? { name: author.name } : null };
    });
    return sendResponse(res, 200, populated.reverse());
  }

  if (url === '/api/content/articles' && req.method === 'POST') {
    if (!(await protect(req, res))) return;
    if (req.user.role !== 'admin') return sendError(res, 403, 'Admin only');
    
    const body = await parseBody(req);
    const article = DB.insert('articles', { ...body, author: req.user._id });
    return sendResponse(res, 201, article);
  }

  if (url === '/api/content/tips' && req.method === 'GET') {
    return sendResponse(res, 200, DB.read('tips').reverse());
  }

  if (url === '/api/content/tips' && req.method === 'POST') {
    if (!(await protect(req, res))) return;
    if (req.user.role !== 'admin') return sendError(res, 403, 'Admin only');
    
    const body = await parseBody(req);
    const tip = DB.insert('tips', { ...body, author: req.user._id });
    return sendResponse(res, 201, tip);
  }

  // --- User Routes: Appointments ---
  if (url === '/api/users/appointments' && req.method === 'POST') {
    if (!(await protect(req, res))) return;
    const body = await parseBody(req);
    const apt = DB.insert('appointments', { ...body, patient: req.user._id, status: 'scheduled' });
    return sendResponse(res, 201, apt);
  }

  if (url === '/api/users/appointments' && req.method === 'GET') {
    if (!(await protect(req, res))) return;
    const myApts = DB.find('appointments', a => a.patient === req.user._id).reverse();
    return sendResponse(res, 200, myApts);
  }

  // --- User Routes: Consultations ---
  if (url === '/api/users/consultations' && req.method === 'POST') {
    if (!(await protect(req, res))) return;
    const body = await parseBody(req);
    const cons = DB.insert('consultations', { ...body, patient: req.user._id, status: 'pending' });
    return sendResponse(res, 201, cons);
  }

  if (url === '/api/users/consultations' && req.method === 'GET') {
    if (!(await protect(req, res))) return;
    const myCons = DB.find('consultations', c => c.patient === req.user._id).reverse();
    return sendResponse(res, 200, myCons);
  }

  // --- Admin Routes ---
  if (url.startsWith('/api/users/admin')) {
    if (!(await protect(req, res))) return;
    if (req.user.role !== 'admin') return sendError(res, 403, 'Admin only');

    if (url === '/api/users/admin/consultations' && req.method === 'GET') {
      const cons = DB.read('consultations');
      const populated = cons.map(c => {
        const p = DB.findById('users', c.patient);
        return { ...c, patient: p ? { name: p.name, email: p.email } : null };
      });
      return sendResponse(res, 200, populated.reverse());
    }

    const consultParams = matchRoute(url, '/api/users/admin/consultations/:id');
    if (consultParams && req.method === 'PUT') {
      const body = await parseBody(req);
      const updated = DB.update('consultations', consultParams.id, {
        doctorResponse: body.response,
        status: 'responded'
      });
      if (updated) return sendResponse(res, 200, updated);
      else return sendError(res, 404, 'Consultation not found');
    }
  }

  // Fallback
  sendError(res, 404, 'API endpoint not found');
});

server.listen(PORT, () => {
  console.log(`Pure Node.js Server running on port ${PORT}`);
});
