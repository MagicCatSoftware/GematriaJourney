
// server/index.js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import passport from 'passport';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

import { authRequired } from './middleware/auth.js';
import { requirePaid } from './middleware/roles.js';

import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';

import User from './models/User.js';
import Gematria from './models/Gematria.js';
import Entry from './models/Entry.js';

import adminRouter from './routes/admin.js';

import Stripe from 'stripe';
import {
  generateUserKey,
  encryptUserKeyWithMaster,
  decryptUserKeyWithMaster,
  encryptWithKey,
  decryptWithKey
} from './utils/crypto.js';

// ---------- Config ----------
const PORT = process.env.PORT || 4002;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const MASTER_KEY = Buffer.from(process.env.MASTER_KEY || '', 'base64'); // 32 bytes

if (MASTER_KEY.length !== 32) {
  console.warn('[WARN] MASTER_KEY must be 32 bytes (base64). Current length:', MASTER_KEY.length);
}

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);

// IMPORTANT: Stripe webhook needs raw body BEFORE express.json()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' });
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const sessionObj = event.data.object;
      const email = sessionObj.customer_email;
      if (email) {
        const user = await User.findOne({ email });
        if (user) {
          user.isLifetime = true;
          await user.save();
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('webhook error', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Normal middleware AFTER webhook raw body
app.use(express.json());
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));
app.use(cookieParser());
app.use(session({
  name: 'gj.sid',
  secret: process.env.SESSION_SECRET || 'dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // set true behind HTTPS/proxy in prod
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ---------- Uploads (photos) ----------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UP = path.join(__dirname, 'uploads');
if (!fs.existsSync(UP)) fs.mkdirSync(UP, { recursive: true });
app.use('/uploads', express.static(UP));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UP),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const okExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${req.user?._id || 'anon'}_${Date.now()}${okExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpe?g|gif|webp)$/i.test(file.mimetype || '');
    cb(ok ? null : new Error('Only image uploads are allowed'), ok);
  }
});

// ---------- Session debug ----------
app.get('/api/debug-session', (req, res) => {
  res.json({
    hasUser: !!req.user,
    user: req.user ? { id: req.user._id, email: req.user.email, name: req.user.name } : null,
    sessionKeys: Object.keys(req.session || {}),
  });
});

// ---------- DB ----------
mongoose.connect(process.env.MONGODB_URI, {})
  .then(() => console.log('Mongo connected'))
  .catch(e => console.error('Mongo error', e));

// ---------- Auth helpers ----------
function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.status(401).json({ error: 'unauthenticated' });
}

// ---------- Passport serialize/deserialize ----------
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const u = await User.findById(id);
    done(null, u);
  } catch (e) {
    done(e);
  }
});
app.use('/admin', adminRouter);
// ---------- OAuth Strategies ----------
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: `${SERVER_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
    let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
    if (!user) {
      const userKey = generateUserKey();
      const encryptedUserKey = encryptUserKeyWithMaster(MASTER_KEY, userKey);
      user = await User.create({
        name: profile.displayName,
        email,
        googleId: profile.id,
        encryptedUserKey
      });
    } else if (!user.googleId) {
      user.googleId = profile.id;
      await user.save();
    }
    done(null, user);
  } catch (err) { done(err); }
}));

passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_CLIENT_ID || '',
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
  callbackURL: `${SERVER_URL}/auth/facebook/callback`,
  profileFields: ['id', 'displayName', 'emails']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
    let user = await User.findOne({ $or: [{ facebookId: profile.id }, { email }] });
    if (!user) {
      const userKey = generateUserKey();
      const encryptedUserKey = encryptUserKeyWithMaster(MASTER_KEY, userKey);
      user = await User.create({
        name: profile.displayName,
        email,
        facebookId: profile.id,
        encryptedUserKey
      });
    } else if (!user.facebookId) {
      user.facebookId = profile.id;
      await user.save();
    }
    done(null, user);
  } catch (err) { done(err); }
}));

// ---------- Auth routes ----------
app.get('/auth/google', passport.authenticate('google', { scope: ['profile','email'] }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/login?err=oauth` }),
  (req, res) => res.redirect(`${CLIENT_URL}/auth-success`)
);

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: `${CLIENT_URL}/login?err=oauth` }),
  (req, res) => res.redirect(`${CLIENT_URL}/auth-success`)
);

app.get('/auth/failure', (req,res)=>res.send('Auth failed'));

// ---------- Me ----------
app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  const { _id, name, email, isLifetime, photoUrl, bio } = req.user;
  res.json({ id: _id, name, email, isLifetime: !!isLifetime, photoUrl: photoUrl || '', bio: bio || '' });
});

// Full profile (self)
app.get('/api/me/full', ensureAuth, async (req, res) => {
  try {
    const u = await User.findById(req.user._id)
      .select('_id role name email photoUrl createdAt bio')
      .lean();
    res.json(u);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/me', ensureAuth, async (req, res) => {
  try {
    const { name, bio } = req.body || {};
    const update = {};
    if (typeof name === 'string') update.name = name.trim().slice(0, 100);
    if (typeof bio === 'string')  update.bio  = bio.trim().slice(0, 1000);
    const u = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true })
      .select('_id name email photoUrl createdAt bio')
      .lean();
    res.json(u);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/me/photo', ensureAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file' });
    const photoUrl = `${SERVER_URL}/uploads/${req.file.filename}`;
    await User.findByIdAndUpdate(req.user._id, { photoUrl });
    res.json({ photoUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mini profile (hover card)
app.get('/api/users/:id/mini', async (req, res) => {
  try {
    const u = await User.findById(req.params.id)
      .select('_id name email photoUrl createdAt bio')
      .lean();
    if (!u) return res.status(404).json({ error: 'not found' });
    res.json(u);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- Gematria CRUD ----------
app.post('/api/gematrias', ensureAuth, async (req,res) => {
  const { name, letters } = req.body; // letters = { a:1, b:2, ... }
  try {
    const doc = await Gematria.create({
      name,
      ...letters,
      createdBy: req.user._id
    });
    req.user.gematriaIds.push(doc._id);
    await req.user.save();
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/gematrias', async (req,res)=> {
  const list = await Gematria.find().limit(500).populate('createdBy', 'name email').lean();
  res.json(list);
});

// ---------- Entry create / list (private-encrypted or public) ----------
app.post('/api/entries', ensureAuth, async (req,res) => {
  const { gematriaId, phrase, visibility='private' } = req.body;
  try {
    const gem = await Gematria.findById(gematriaId);
    if (!gem) return res.status(400).json({ error: 'invalid gematria' });

    const normalized = (phrase || '').toLowerCase().replace(/[^a-z]/g,'');
    let total = 0;
    for (const ch of normalized) total += (gem[ch] || 0);

    if (visibility === 'public') {
      const e = await Entry.create({
        owner: req.user._id,
        gematria: gem._id,
        phrase,
        result: total,
        visibility: 'public'
      });
      return res.json(e);
    } else {
      const userKeyBuffer = decryptUserKeyWithMaster(MASTER_KEY, req.user.encryptedUserKey);
      const payload = JSON.stringify({ phrase, result: total, createdAt: new Date().toISOString() });
      const ciphertext = encryptWithKey(userKeyBuffer, payload);
      const e = await Entry.create({
        owner: req.user._id,
        gematria: gem._id,
        visibility: 'private',
        ciphertext
      });
      return res.json({ ok: true, id: e._id });
    }
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

app.get('/api/entries', ensureAuth,  async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const skip  = Math.max(Number(req.query.skip) || 0, 0);
    const q     = (req.query.q || '').trim();

    const findQuery = q
      ? { $or: [
          { title: { $regex: q, $options: 'i' } },
          { text: { $regex: q, $options: 'i' } },
          { visibility: { $regex: q, $options: 'i' } },
        ]}
      : {};

    const entries = await Entry.find(findQuery)
      .populate('owner', 'name email')
      .populate('gematria')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ entries });
  } catch (e) {
    console.error('Error fetching entries:', e);
    res.status(500).json({ error: e.message });
  }
});

// Your entries (decrypt private)
app.get('/api/my-entries', ensureAuth, async (req, res) => {
  try {
    const entries = await Entry.find({ owner: req.user._id })
      .populate('gematria')
      .lean();
    const userKeyBuffer = decryptUserKeyWithMaster(MASTER_KEY, req.user.encryptedUserKey);

    const out = entries.map(ent => {
      if (ent.visibility === 'public') {
        return { ...ent, decrypted: { phrase: ent.phrase, result: ent.result } };
      } else {
        if (!ent.ciphertext) return { ...ent, decrypted: null };
        try {
          const json = decryptWithKey(userKeyBuffer, ent.ciphertext);
          return { ...ent, decrypted: JSON.parse(json) };
        } catch (err) {
          return { ...ent, decrypted: null, _decryptError: true };
        }
      }
    });
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Toggle visibility publish/private
app.patch('/api/entries/:id/visibility', ensureAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { visibility } = req.body;
    if (!['public','private'].includes(visibility)) {
      return res.status(400).json({ error: 'visibility must be "public" or "private"' });
    }

    const ent = await Entry.findById(id).populate('gematria');
    if (!ent) return res.status(404).json({ error: 'entry not found' });
    if (String(ent.owner) !== String(req.user._id)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    if (visibility === 'public') {
      if (ent.visibility === 'public') return res.json(ent);
      if (!ent.ciphertext) return res.status(400).json({ error: 'no private payload to publish' });

      const userKeyBuffer = decryptUserKeyWithMaster(MASTER_KEY, req.user.encryptedUserKey);
      let payload;
      try {
        payload = JSON.parse(decryptWithKey(userKeyBuffer, ent.ciphertext));
      } catch {
        return res.status(500).json({ error: 'decrypt failed' });
      }
      if (!payload || typeof payload.phrase !== 'string' || typeof payload.result !== 'number') {
        return res.status(400).json({ error: 'invalid private payload' });
      }

      ent.phrase = payload.phrase;
      ent.result = payload.result;
      ent.visibility = 'public';
      await ent.save();
      return res.json({ ok: true });
    }

    if (visibility === 'private') {
      if (ent.visibility === 'private') return res.json(ent);

      const userKeyBuffer = decryptUserKeyWithMaster(MASTER_KEY, req.user.encryptedUserKey);
      const payload = JSON.stringify({
        phrase: ent.phrase || '',
        result: typeof ent.result === 'number' ? ent.result : 0,
        createdAt: new Date().toISOString(),
      });
      ent.ciphertext = encryptWithKey(userKeyBuffer, payload);
      ent.visibility = 'private';
      ent.phrase = undefined;
      ent.result = undefined;

      await ent.save();
      return res.json({ ok: true });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- Public search (legacy simple) ----------
app.get('/api/search', async (req, res) => {
  const { phrase, gematriaId } = req.query;
  const q = { visibility: 'public' };
  if (gematriaId) q.gematria = gematriaId;
  if (phrase) q.phrase = { $regex: phrase, $options: 'i' };
  const results = await Entry.find(q)
    .populate('gematria owner', 'name email')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json(results);
});

// ---------- Public search (value + phrase + systems + pagination) ----------
/**
 * GET /api/public/entries
 * ?page=1&limit=25&value=198&systems[]=simple&systems[]=english&systems[]=hebrew&q=truth
 */
app.get('/api/public/entries', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '25', 10)));
    const qStr = (req.query.q || '').toString().trim();
    const value = req.query.value != null ? Number(req.query.value) : null;
    const systems = Array.isArray(req.query.systems) ? req.query.systems
      : (req.query.systems ? [req.query.systems] : ['simple','english','hebrew']);

    const findQ = { visibility: 'public' };
    if (qStr) findQ.phrase = { $regex: qStr, $options: 'i' };

    // Pull a page first, then filter by systems/value on server
    const cursor = Entry.find(findQ)
      .populate('gematria owner', 'name email')
      .sort({ createdAt: -1 });

    const total = await Entry.countDocuments(findQ);
    const docs = await cursor.skip((page - 1) * limit).limit(limit).lean();

    // Static system calculators (server-side)
    const MAPS = {
      simple: Object.fromEntries(Array.from({ length: 26 }, (_, i) => [String.fromCharCode(97 + i), i + 1])),
      english: Object.fromEntries(Array.from({ length: 26 }, (_, i) => [String.fromCharCode(97 + i), (i + 1) * 6])),
      // Custom "Hebrew" per your mapping (Latin letters):
      hebrew: {
        a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,
        k:10,l:20,m:30,n:40,o:50,p:60,q:70,r:80,
        s:90,t:100,u:200,x:300,y:400,z:500,j:600,
        v:700,w:900
      }
    };
    const REG = /[a-z]/;

    const sumBy = (str, map) => {
      if (!str) return 0;
      let t = 0;
      for (const ch of str.toLowerCase()) {
        if (!REG.test(ch)) continue;
        if (map[ch]) t += map[ch];
      }
      return t;
    };

    const wantValue = (value != null && !Number.isNaN(value));
    const wantSystems = new Set(systems.length ? systems : ['simple','english','hebrew']);

    const items = docs.filter(d => {
      if (!wantValue) return true;
      const s = sumBy(d.phrase, MAPS.simple);
      const e = sumBy(d.phrase, MAPS.english);
      const h = sumBy(d.phrase, MAPS.hebrew);
      if (wantSystems.has('simple') && s === value) return true;
      if (wantSystems.has('english') && e === value) return true;
      if (wantSystems.has('hebrew') && h === value) return true;
      return false;
    });

    res.json({ items, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- Stripe checkout ----------
app.post('/api/create-checkout-session', ensureAuth, async (req, res) => {
  try {
    const sessionObj = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'GematriaJourney Lifetime Membership' },
          unit_amount: 2000
        },
        quantity: 1
      }],
      success_url: `${CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/payment-cancel`
    });
    res.json({ url: sessionObj.url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  req.session?.destroy?.(() => {});
  res.json({ ok: true });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log('Server listening on', PORT);
});

