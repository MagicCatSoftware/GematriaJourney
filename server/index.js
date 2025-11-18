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
import XLSX from 'xlsx';
import multer from 'multer';

import { authRequired } from './middleware/auth.js';
import { requirePaidOrAdmin, requireAdmin, requireAuthOnly } from './middleware/roles.js';

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

// ---------- Extend Entry schema with Master List info ----------
Entry.schema.add({
  master: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }
});

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);

// IMPORTANT: Stripe webhook needs raw body BEFORE express.json()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' });
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const ownerId = s.client_reference_id;
      const email = s.customer_email || s.customer_details?.email;

      let user = null;
      if (ownerId) user = await User.findById(ownerId);
      if (!user && email) user = await User.findOne({ email });

      if (user && !user.isLifetime) {
        user.isLifetime = true;
        user.lifetimeAt = new Date();
        user.lastCheckoutSessionId = s.id;
        await user.save();
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('webhook error', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// ---------- Simple rate limiter for /api/public/entries (10 requests/min per IP) ----------
// ---------- Rate limit: create entries (max 10 per minute per user) ----------
const createEntryBuckets = new Map();
const CREATE_WINDOW_MS   = 60 * 1000; // 1 minute
const CREATE_MAX_PER_WIN = 10;

function rateLimitCreateEntry(req, res, next) {
  try {
    if (!req.user || !req.user._id) {
      // should already be guarded by requirePaidOrAdmin, but be safe
      return res.status(401).json({ error: 'unauthenticated' });
    }

    const key = String(req.user._id);
    const now = Date.now();
    let bucket = createEntryBuckets.get(key);

    // New window if none exists or window expired
    if (!bucket || now - bucket.start > CREATE_WINDOW_MS) {
      bucket = { start: now, count: 0 };
    }

    if (bucket.count >= CREATE_MAX_PER_WIN) {
      return res.status(429).json({
        error: 'rate_limited',
        message:
          'Rate limit reached: you can only create up to 10 entries per minute. Please wait a moment and try again.',
      });
    }

    bucket.count += 1;
    createEntryBuckets.set(key, bucket);
    next();
  } catch (err) {
    console.warn('rateLimitCreateEntry error:', err.message);
    // fail open rather than breaking entry creation
    next();
  }
}

// Normal middleware AFTER webhook raw body
app.use(express.json());
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(
  session({
    name: 'gj.sid',
    secret: process.env.SESSION_SECRET || 'dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // set true behind HTTPS/proxy in prod
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use('/admin', adminRouter);

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
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpe?g|gif|webp)$/i.test(file.mimetype || '');
    cb(ok ? null : new Error('Only image uploads are allowed'), ok);
  },
});

// ---------- Session debug ----------
app.get('/api/debug-session', (req, res) => {
  res.json({
    hasUser: !!req.user,
    user: req.user
      ? { id: req.user._id, email: req.user.email, name: req.user.name }
      : null,
    sessionKeys: Object.keys(req.session || {}),
  });
});

// ---------- DB ----------
mongoose
  .connect(process.env.MONGODB_URI, {})
  .then(() => console.log('Mongo connected'))
  .catch((e) => console.error('Mongo error', e));

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

// ---------- OAuth Strategies ----------
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: `${SERVER_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails && profile.emails[0] && profile.emails[0].value;
        let user = await User.findOne({
          $or: [{ googleId: profile.id }, { email }],
        });
        if (!user) {
          const userKey = generateUserKey();
          const encryptedUserKey = encryptUserKeyWithMaster(MASTER_KEY, userKey);
          user = await User.create({
            name: profile.displayName,
            email,
            googleId: profile.id,
            encryptedUserKey,
          });
        } else if (!user.googleId) {
          user.googleId = profile.id;
          await user.save();
        }
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
      callbackURL: `${SERVER_URL}/auth/facebook/callback`,
      profileFields: ['id', 'displayName', 'emails'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails && profile.emails[0] && profile.emails[0].value;
        let user = await User.findOne({
          $or: [{ facebookId: profile.id }, { email }],
        });
        if (!user) {
          const userKey = generateUserKey();
          const encryptedUserKey = encryptUserKeyWithMaster(MASTER_KEY, userKey);
          user = await User.create({
            name: profile.displayName,
            email,
            facebookId: profile.id,
            encryptedUserKey,
          });
        } else if (!user.facebookId) {
          user.facebookId = profile.id;
          await user.save();
        }
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

// ---------- Auth routes ----------
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${CLIENT_URL}/login?err=oauth`,
  }),
  (req, res) => res.redirect(`${CLIENT_URL}/auth-success`)
);

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
app.get(
  '/auth/facebook/callback',
  passport.authenticate('facebook', {
    failureRedirect: `${CLIENT_URL}/login?err=oauth`,
  }),
  (req, res) => res.redirect(`${CLIENT_URL}/auth-success`)
);

app.get('/auth/failure', (req, res) => res.send('Auth failed'));

// ---------- Helper: unpaid check ----------
async function assertNotAlreadyPaid(userId) {
  const fresh = await User.findById(userId).select('_id role isLifetime').lean();
  if (!fresh) throw new Error('user_not_found');
  if (fresh.role === 'admin') {
    const e = new Error('admins_do_not_pay');
    e.status = 409;
    throw e;
  }
  if (fresh.isLifetime) {
    const e = new Error('already_lifetime');
    e.status = 409;
    throw e;
  }
  return fresh;
}

// ---------- Me & profile ----------
app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  const { _id, name, email, isLifetime, photoUrl, bio, role } = req.user;
  res.json({
    id: _id,
    name,
    email,
    role: role || 'user',
    isLifetime: !!isLifetime,
    photoUrl: photoUrl || '',
    bio: bio || '',
  });
});

// Full profile (self)
app.get('/api/me/full', requirePaidOrAdmin, async (req, res) => {
  try {
    const u = await User.findById(req.user._id)
      .select('_id role name isLifetime email photoUrl createdAt bio')
      .lean();
    res.json(u);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/me', requirePaidOrAdmin, async (req, res) => {
  try {
    const { name, bio } = req.body || {};
    const update = {};
    if (typeof name === 'string') update.name = name.trim().slice(0, 100);
    if (typeof bio === 'string') update.bio = bio.trim().slice(0, 1000);
    const u = await User.findByIdAndUpdate(req.user._id, update, {
      new: true,
      runValidators: true,
    })
      .select('_id name email photoUrl createdAt bio')
      .lean();
    res.json(u);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post(
  '/api/me/photo',
  requirePaidOrAdmin,
  upload.single('photo'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'no file' });
      const photoUrl = `${SERVER_URL}/uploads/${req.file.filename}`;
      await User.findByIdAndUpdate(req.user._id, { photoUrl });
      res.json({ photoUrl });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// Mini profile (hover card)
app.get('/api/users/:id/mini', async (req, res) => {
  try {
    const u = await User.findById(req.params.id)
      .select('_id name photoUrl createdAt bio')
      .lean();
    if (!u) return res.status(404).json({ error: 'not found' });
    res.json(u);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Gematria CRUD ----------
app.post('/api/gematrias', requirePaidOrAdmin, async (req, res) => {
  const { name, letters } = req.body; // letters = { a:1, b:2, ... }
  try {
    const doc = await Gematria.create({
      name,
      ...letters,
      createdBy: req.user._id,
    });
    req.user.gematriaIds.push(doc._id);
    await req.user.save();
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/gematrias', async (req, res) => {
  const list = await Gematria.find()
    .limit(500)
    .populate('createdBy', 'name email')
    .lean();
  res.json(list);
});

// ---------- Entry create / list (private-encrypted or public) ----------
app.post(
  '/api/entries',
  requirePaidOrAdmin,
  rateLimitCreateEntry,   // <--- NEW
  async (req, res) => {
    const { gematriaId, phrase, visibility = 'private' } = req.body;
    try {
      const gem = await Gematria.findById(gematriaId);
      if (!gem) return res.status(400).json({ error: 'invalid gematria' });

      const normalized = (phrase || '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');
      let total = 0;
      for (const ch of normalized) total += gem[ch] || 0;

      if (visibility === 'public') {
        const e = await Entry.create({
          owner: req.user._id,
          gematria: gem._id,
          phrase,
          result: total,
          visibility: 'public',
        });
        return res.json(e);
      } else {
        const userKeyBuffer = decryptUserKeyWithMaster(
          MASTER_KEY,
          req.user.encryptedUserKey
        );
        const payload = JSON.stringify({
          phrase,
          result: total,
          createdAt: new Date().toISOString(),
        });
        const ciphertext = encryptWithKey(userKeyBuffer, payload);
        const e = await Entry.create({
          owner: req.user._id,
          gematria: gem._id,
          visibility: 'private',
          ciphertext,
        });
        return res.json({ ok: true, id: e._id });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
);


app.get('/api/entries', requirePaidOrAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const q = (req.query.q || '').trim();

    const findQuery = q
      ? {
          $or: [
            { title: { $regex: q, $options: 'i' } },
            { text: { $regex: q, $options: 'i' } },
            { visibility: { $regex: q, $options: 'i' } },
          ],
        }
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

// Your entries (decrypt private/public if ciphertext exists, like master list)
app.get('/api/my-entries', requirePaidOrAdmin, async (req, res) => {
  try {
    const docs = await Entry.find({ owner: req.user._id })
      .populate('gematria', 'name')
      .populate('owner', 'encryptedUserKey name email')
      .sort({ createdAt: -1 })
      .lean();

    const out = [];

    for (const ent of docs) {
      let phrase = null;
      let result = null;

      // 1) If we have ciphertext + owner key, try to decrypt (ANY visibility)
      if (
        ent.ciphertext &&
        ent.owner?.encryptedUserKey &&
        MASTER_KEY.length === 32
      ) {
        try {
          const userKeyBuffer = decryptUserKeyWithMaster(
            MASTER_KEY,
            ent.owner.encryptedUserKey
          );
          const json = decryptWithKey(userKeyBuffer, ent.ciphertext);
          const payload = JSON.parse(json);

          if (payload && typeof payload.phrase === 'string') {
            phrase = payload.phrase;
          }
          if (payload && Number.isFinite(payload.result)) {
            result = payload.result;
          }
        } catch (err) {
          console.warn(
            '[/api/my-entries] decrypt fail:',
            ent._id,
            err.message
          );
        }
      }

      // 2) Fallback to stored plain fields if needed
      if (
        (!phrase || !phrase.trim()) &&
        typeof ent.phrase === 'string' &&
        ent.phrase.trim().length > 0
      ) {
        phrase = ent.phrase;
      }
      if (result === null && Number.isFinite(ent.result)) {
        result = ent.result;
      }

      // 3) Push combined object; frontend uses decrypted.*
      out.push({
        ...ent,
        decrypted: {
          phrase: phrase || '',
          result,
        },
      });
    }

    res.json(out);
  } catch (e) {
    console.error('[/api/my-entries] error:', e);
    res.status(500).json({ error: e.message });
  }
});



// Toggle visibility publish/private
app.patch('/api/entries/:id/visibility', requirePaidOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { visibility } = req.body;
    if (!['public', 'private'].includes(visibility)) {
      return res
        .status(400)
        .json({ error: 'visibility must be "public" or "private"' });
    }

    const ent = await Entry.findById(id).populate('gematria');
    if (!ent) return res.status(404).json({ error: 'entry not found' });
    if (String(ent.owner) !== String(req.user._id)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    if (visibility === 'public') {
      if (ent.visibility === 'public') return res.json(ent);
      if (!ent.ciphertext)
        return res
          .status(400)
          .json({ error: 'no private payload to publish' });

      const userKeyBuffer = decryptUserKeyWithMaster(
        MASTER_KEY,
        req.user.encryptedUserKey
      );
      let payload;
      try {
        payload = JSON.parse(decryptWithKey(userKeyBuffer, ent.ciphertext));
      } catch {
        return res.status(500).json({ error: 'decrypt failed' });
      }
      if (
        !payload ||
        typeof payload.phrase !== 'string' ||
        typeof payload.result !== 'number'
      ) {
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

      const userKeyBuffer = decryptUserKeyWithMaster(
        MASTER_KEY,
        req.user.encryptedUserKey
      );
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
// ---------- Public search (value + phrase + systems + pagination) ----------
/**
 * GET /api/public/entries
 * ?page=1&limit=25&value=198&systems[]=simple&systems[]=english&systems[]=hebrew&q=truth
 */
// ---------- Public search (value + phrase + systems + pagination + sorting) ----------
/**
 * GET /api/public/entries
 * ?page=1&limit=50&value=198&systems[]=simple&systems[]=english&systems[]=hebrew&q=truth&sort=createdAt&dir=desc
 */
app.get('/api/public/entries', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '25', 10)));

    const qStr    = (req.query.q || '').toString().trim();
    const value   = req.query.value != null ? Number(req.query.value) : null;
    const systems = Array.isArray(req.query.systems)
      ? req.query.systems
      : req.query.systems
      ? [req.query.systems]
      : ['simple', 'english', 'hebrew'];

    // ---- Sorting ----
    const sortParam  = (req.query.sort || 'createdAt').toString();
    const dirParam   = (req.query.dir  || 'desc').toString().toLowerCase();
    const allowedMap = {
      createdAt: 'createdAt',
      result:    'result',
      phrase:    'phrase',
    };
    const sortField = allowedMap[sortParam] || 'createdAt';
    const sortDir   = dirParam === 'asc' ? 1 : -1;

    // Only public entries
    const findQ = { visibility: 'public' };
    if (qStr) {
      // We'll phrase-filter again after decrypting, but this helps a bit
      findQ.phrase = { $regex: qStr, $options: 'i' };
    }

    // Count with the same basic filter (public + phrase)
    const total = await Entry.countDocuments(findQ);

    // IMPORTANT: we must populate owner.encryptedUserKey to decrypt
    const rawDocs = await Entry.find(findQ)
      .populate('gematria', 'name')
      .populate('owner', 'name email encryptedUserKey')
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // ---- Built-in maps for numeric filter ----
    const A_Z = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const MAPS = {
      simple: Object.fromEntries(A_Z.map((c, i) => [c, i + 1])),
      english: Object.fromEntries(A_Z.map((c, i) => [c, (i + 1) * 6])),
      hebrew: {
        a: 1,
        b: 2,
        c: 3,
        d: 4,
        e: 5,
        f: 6,
        g: 7,
        h: 8,
        i: 9,
        k: 10,
        l: 20,
        m: 30,
        n: 40,
        o: 50,
        p: 60,
        q: 70,
        r: 80,
        s: 90,
        t: 100,
        u: 200,
        x: 300,
        y: 400,
        z: 500,
        j: 600,
        v: 700,
        w: 900,
      },
    };
    const REG = /[a-z]/;

    const sumBy = (str, map) => {
      if (!str) return 0;
      let t = 0;
      const s = String(str).toLowerCase();
      for (const ch of s) {
        if (!REG.test(ch)) continue;
        if (map[ch]) t += map[ch];
      }
      return t;
    };

    const wantValue   = value != null && !Number.isNaN(value);
    const wantSystems = new Set(
      systems && systems.length ? systems : ['simple', 'english', 'hebrew']
    );

    // ---- Normalize each entry: ensure phrase/result exist; decrypt if needed ----
    const normalized = [];

    for (const ent of rawDocs) {
      let phrase =
        typeof ent.phrase === 'string' && ent.phrase.trim().length > 0
          ? ent.phrase
          : null;
      let result = Number.isFinite(ent.result) ? ent.result : null;

      // If we don't have phrase/result but we DO have ciphertext + user key, decrypt
      if ((!phrase || result === null) && ent.ciphertext && ent.owner?.encryptedUserKey) {
        try {
          const userKeyBuffer = decryptUserKeyWithMaster(
            MASTER_KEY,
            ent.owner.encryptedUserKey
          );
          const json    = decryptWithKey(userKeyBuffer, ent.ciphertext);
          const payload = JSON.parse(json);

          if (!phrase && payload && typeof payload.phrase === 'string') {
            phrase = payload.phrase;
          }
          if (result === null && payload && Number.isFinite(payload.result)) {
            result = payload.result;
          }
        } catch (err) {
          console.warn('public decrypt fail', ent._id, err.message);
        }
      }

      normalized.push({
        _id: ent._id,
        createdAt: ent.createdAt,
        visibility: ent.visibility,
        master: ent.master,
        // what the frontend actually uses:
        phrase: phrase || '',
        result: Number.isFinite(result) ? result : null,
        gematria: ent.gematria || null,
        owner: ent.owner
          ? {
              _id:   ent.owner._id,
              name:  ent.owner.name,
              email: ent.owner.email,
            }
          : null,
      });
    }

    // ---- Optional phrase filter AFTER decryption (in case original findQ missed some) ----
    const phraseFiltered = qStr
      ? normalized.filter((d) =>
          (d.phrase || '').toLowerCase().includes(qStr.toLowerCase())
        )
      : normalized;

    // ---- Apply numeric/system filter if a value is provided ----
    const items = phraseFiltered.filter((d) => {
      if (!wantValue) return true;

      const phrase = d.phrase || '';
      const s = sumBy(phrase, MAPS.simple);
      const e = sumBy(phrase, MAPS.english);
      const h = sumBy(phrase, MAPS.hebrew);

      if (wantSystems.has('simple')  && s === value) return true;
      if (wantSystems.has('english') && e === value) return true;
      if (wantSystems.has('hebrew')  && h === value) return true;
      return false;
    });

    res.json({ items, total });
  } catch (e) {
    console.error('GET /api/public/entries error', e);
    res.status(500).json({ error: e.message });
  }
});



// ---------- Delete entry ----------
app.delete('/api/entries/:id', requirePaidOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const ent = await Entry.findById(id);
    if (!ent) return res.status(404).json({ error: 'entry_not_found' });
    if (String(ent.owner) !== String(req.user._id)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    await ent.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    console.error('delete entry error', e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- Publish all private entries (bulk) ----------
app.post('/api/entries/publish-all', requirePaidOrAdmin, async (req, res) => {
  try {
    const privates = await Entry.find({
      owner: req.user._id,
      visibility: 'private',
    }).lean();
    if (!privates.length) return res.json({ published: 0, skipped: 0 });

    const userKeyBuffer = decryptUserKeyWithMaster(
      MASTER_KEY,
      req.user.encryptedUserKey
    );
    let published = 0,
      skipped = 0;

    for (const p of privates) {
      if (!p.ciphertext) {
        skipped++;
        continue;
      }
      let payload;
      try {
        payload = JSON.parse(decryptWithKey(userKeyBuffer, p.ciphertext));
      } catch {
        skipped++;
        continue;
      }
      if (
        !payload ||
        typeof payload.phrase !== 'string' ||
        typeof payload.result !== 'number'
      ) {
        skipped++;
        continue;
      }

      await Entry.updateOne(
        { _id: p._id, owner: req.user._id },
        {
          $set: {
            phrase: payload.phrase,
            result: payload.result,
            visibility: 'public',
          },
          $unset: { ciphertext: 1 },
        }
      );
      published++;
    }

    res.json({ published, skipped });
  } catch (e) {
    console.error('publish all error', e);
    res.status(500).json({ error: e.message });
  }
});


// ===== Excel export helpers =====
const A_Z = 'abcdefghijklmnopqrstuvwxyz'.split('');
const MAPS_EXPORT = {
  simple:  Object.fromEntries(A_Z.map((c, i) => [c, i + 1])),
  english: Object.fromEntries(A_Z.map((c, i) => [c, (i + 1) * 6])),
  // Hebrew: A=1..Z=900 (26 letters)
  hebrew:  Object.fromEntries(A_Z.map((c, i) => [c, (i + 1) * (i < 9 ? 1 : i < 18 ? 10 : 100)])),
};
// fix exact 1..900 sequence (optional clarity)
MAPS_EXPORT.hebrew.a=1; MAPS_EXPORT.hebrew.b=2; MAPS_EXPORT.hebrew.c=3; MAPS_EXPORT.hebrew.d=4; MAPS_EXPORT.hebrew.e=5; MAPS_EXPORT.hebrew.f=6; MAPS_EXPORT.hebrew.g=7; MAPS_EXPORT.hebrew.h=8; MAPS_EXPORT.hebrew.i=9;
MAPS_EXPORT.hebrew.j=10; MAPS_EXPORT.hebrew.k=20; MAPS_EXPORT.hebrew.l=30; MAPS_EXPORT.hebrew.m=40; MAPS_EXPORT.hebrew.n=50; MAPS_EXPORT.hebrew.o=60; MAPS_EXPORT.hebrew.p=70; MAPS_EXPORT.hebrew.q=80; MAPS_EXPORT.hebrew.r=90;
MAPS_EXPORT.hebrew.s=100; MAPS_EXPORT.hebrew.t=200; MAPS_EXPORT.hebrew.u=300; MAPS_EXPORT.hebrew.v=400; MAPS_EXPORT.hebrew.w=500; MAPS_EXPORT.hebrew.x=600; MAPS_EXPORT.hebrew.y=700; MAPS_EXPORT.hebrew.z=900;

function builtinTotalsForExport(text = '') {
  const chars = (text || '').toLowerCase().match(/[a-z]/g) || [];
  const sum = (map) => chars.reduce((t, ch) => t + (map[ch] || 0), 0);
  return {
    simple:  sum(MAPS_EXPORT.simple),
    english: sum(MAPS_EXPORT.english),
    hebrew:  sum(MAPS_EXPORT.hebrew),
  };
}

function pickPhraseAndResultForExport(ent) {
  // prefer decrypted payload if present (mirrors your /api/master handlers)
  const phrase =
    (ent?.decrypted && typeof ent.decrypted.phrase === 'string' && ent.decrypted.phrase) ||
    (typeof ent?.phrase === 'string' ? ent.phrase : '');
  const result =
    (Number.isFinite(ent?.decrypted?.result) ? ent.decrypted.result : null) ??
    (Number.isFinite(ent?.result) ? ent.result : null);
  return { phrase, result };
}

function rowsFromEntriesForExport(entries, { includeStatus = false } = {}) {
  const header = [
    'Date',
    'Gematria',
    'Phrase',
    'System Result',
    'Simple',
    'English',
    'Hebrew',
  ];
  if (includeStatus) header.push('Status', 'Visibility');

  const rows = [header];

  for (const ent of entries) {
    const date = new Date(ent?.master?.submittedAt || ent?.createdAt || Date.now()).toLocaleString();
    const gem = ent?.gematria?.name || '';
    const { phrase, result } = pickPhraseAndResultForExport(ent);
    const totals = builtinTotalsForExport(phrase);

    const row = [
      date,
      gem,
      phrase,
      Number.isFinite(result) ? result : '',
      totals.simple,
      totals.english,
      totals.hebrew,
    ];
    if (includeStatus) row.push(ent?.master?.status || '', ent?.visibility || '');
    rows.push(row);
  }

  return rows;
}

function sendWorkbook(res, rows, filename) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Master');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buf);
}

// Re-usable fetch+decrypt for export (approved or admin list)
async function fetchAndDecryptForExport(findQuery) {
  const docs = await Entry.find(findQuery)
    .populate('gematria', 'name')
    .populate('owner', 'encryptedUserKey')
    .sort({ 'master.submittedAt': 1, createdAt: 1 })
    .lean();

  const out = [];
  for (const ent of docs) {
    let phrase = null;
    let result = null;

    if (ent.ciphertext && ent.owner?.encryptedUserKey) {
      try {
        const userKeyBuffer = decryptUserKeyWithMaster(MASTER_KEY, ent.owner.encryptedUserKey);
        const json = decryptWithKey(userKeyBuffer, ent.ciphertext);
        const payload = JSON.parse(json);
        if (payload && typeof payload.phrase === 'string') phrase = payload.phrase;
        if (payload && Number.isFinite(payload.result)) result = payload.result;
      } catch (err) {
        console.warn('export decrypt fail', ent._id, err.message);
      }
    }
    if (!phrase && typeof ent.phrase === 'string' && ent.phrase.trim()) phrase = ent.phrase;
    if (result === null && Number.isFinite(ent.result)) result = ent.result;

    out.push({
      ...ent,
      decrypted: { phrase: phrase || '', result },
    });
  }
  return out;
}


// ---------- Master List routes ----------
// Bulk submit ALL of the current user's entries to Master List (requires paid/admin)
app.post('/api/master/bulk-submit', requirePaidOrAdmin, async (req, res) => {
  try {
    const entries = await Entry.find({
      owner: req.user._id,
      visibility: { $in: ['private', 'public'] },
      $or: [
        { 'master.status': { $exists: false } },
        { 'master.status': { $in: ['none', 'rejected'] } },
      ],
    });

    if (!entries.length) {
      return res.json({ ok: true, updated: 0, skipped: 0 });
    }

    const now = new Date();
    let updated = 0;

    await Promise.all(
      entries.map((entry) => {
        entry.master = entry.master || {};
        entry.master.status = 'pending';
        entry.master.submittedAt = now;
        entry.master.reviewedAt = undefined;
        entry.master.reviewedBy = undefined;
        updated += 1;
        return entry.save();
      })
    );

    res.json({ ok: true, updated, skipped: 0 });
  } catch (err) {
    console.error('POST /api/master/bulk-submit error:', err);
    res
      .status(500)
      .json({ error: err.message || 'Failed to bulk submit to master list' });
  }
});

// Submit a single entry to Master List (requires paid/admin)
app.post('/api/master/:id/submit', requirePaidOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await Entry.findById(id);

    if (!entry) return res.status(404).json({ error: 'entry_not_found' });
    if (String(entry.owner) !== String(req.user._id)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    entry.master = entry.master || {};
    entry.master.status = 'pending';
    entry.master.submittedAt = new Date();
    entry.master.reviewedAt = undefined;
    entry.master.reviewedBy = undefined;

    await entry.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/master/:id/submit error:', err);
    res
      .status(500)
      .json({ error: err.message || 'failed_to_submit_to_master' });
  }
});

// ---------- Master List: approved-only (public) ----------
// Returns ALL entries whose master.status === 'approved'.
// If an entry is private, we decrypt its ciphertext so the phrase/result
// can still be shown publicly in the master list.
app.get('/api/master/approved', async (req, res) => {
  try {
    const docs = await Entry.find({
      'master.status': 'approved',
    })
      .populate('gematria', 'name')
      .populate('owner', 'encryptedUserKey') // only what we need for decryption
      .sort({ 'master.submittedAt': 1, createdAt: 1 }) // oldest → newest
      .select('phrase result visibility gematria master createdAt ciphertext owner')
      .lean();

    const out = [];

    for (const ent of docs) {
      let phrase = null;
      let result = null;

      // 1) FIRST: try to decrypt if we have ciphertext + owner key
      if (ent.ciphertext && ent.owner?.encryptedUserKey) {
        try {
          const userKeyBuffer = decryptUserKeyWithMaster(
            MASTER_KEY,
            ent.owner.encryptedUserKey
          );
          const json = decryptWithKey(userKeyBuffer, ent.ciphertext);
          const payload = JSON.parse(json);

          if (payload && typeof payload.phrase === 'string') {
            phrase = payload.phrase;
          }
          if (payload && Number.isFinite(payload.result)) {
            result = payload.result;
          }
        } catch (err) {
          console.warn(
            'Failed to decrypt approved entry',
            ent._id,
            err.message
          );
        }
      }

      // 2) FALLBACK: if we still don’t have phrase/result, use stored values
      if (!phrase && typeof ent.phrase === 'string' && ent.phrase.trim().length > 0) {
        phrase = ent.phrase;
      }
      if (result === null && Number.isFinite(ent.result)) {
        result = ent.result;
      }

      // 3) Build the object we send to the client, with a "decrypted" block
      out.push({
        _id: ent._id,
        gematria: ent.gematria,
        master: ent.master,
        createdAt: ent.createdAt,
        visibility: ent.visibility,
        // Keep originals (might be null)
        phrase: ent.phrase ?? null,
        result: Number.isFinite(ent.result) ? ent.result : null,
        // What the frontend should actually use:
        decrypted: {
          phrase: phrase || '',
          result: result,
        },
      });
    }

    res.json(out);
  } catch (err) {
    console.error('GET /api/master/approved error:', err);
    res
      .status(500)
      .json({ error: err.message || 'approved_master_list_failed' });
  }
});

// Public + admin list
// GET /api/master
// - Public / non-auth: only approved + public entries
// - Admin: all entries that have a master.status
// Admin: full master review list (pending/approved/rejected) with decrypted payload
app.get('/api/master', requireAdmin, async (req, res) => {
  try {
    const docs = await Entry.find({
      'master.status': { $in: ['pending', 'approved', 'rejected'] },
    })
      .populate('gematria', 'name')
      .populate('owner', 'encryptedUserKey') // needed for decryption
      .sort({ 'master.submittedAt': 1, createdAt: 1 }) // oldest → newest
      .lean();

    const out = [];

    for (const ent of docs) {
      let phrase = null;
      let result = null;

      // 1) Try to decrypt if we have ciphertext + user key
      if (ent.ciphertext && ent.owner?.encryptedUserKey) {
        try {
          const userKeyBuffer = decryptUserKeyWithMaster(
            MASTER_KEY,
            ent.owner.encryptedUserKey
          );
          const json = decryptWithKey(userKeyBuffer, ent.ciphertext);
          const payload = JSON.parse(json);

          if (payload && typeof payload.phrase === 'string') {
            phrase = payload.phrase;
          }
          if (payload && Number.isFinite(payload.result)) {
            result = payload.result;
          }
        } catch (err) {
          console.warn(
            'Failed to decrypt master entry in /api/master',
            ent._id,
            err.message
          );
        }
      }

      // 2) Fallback to stored plain fields if decryption didn’t give us anything
      if (!phrase && typeof ent.phrase === 'string' && ent.phrase.trim().length > 0) {
        phrase = ent.phrase;
      }
      if (result === null && Number.isFinite(ent.result)) {
        result = ent.result;
      }

      // 3) Push combined object. Frontend uses `decrypted.phrase` / `decrypted.result`.
      out.push({
        ...ent,
        decrypted: {
          phrase: phrase || '',
          result: result,
        },
      });
    }

    res.json(out);
  } catch (err) {
    console.error('GET /api/master error:', err);
    res.status(500).json({ error: err.message || 'master_list_failed' });
  }
});


// Admin: update master status (approved / rejected / pending / none)
app.patch('/api/master/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!['approved', 'pending', 'rejected', 'none'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    const entry = await Entry.findById(id);
    if (!entry) return res.status(404).json({ error: 'entry_not_found' });

    entry.master = entry.master || {};
    entry.master.status = status;
    const now = new Date();

    if (status === 'pending') {
      entry.master.submittedAt = entry.master.submittedAt || now;
      entry.master.reviewedAt = undefined;
      entry.master.reviewedBy = undefined;
    } else if (status === 'approved') {
      entry.master.submittedAt = entry.master.submittedAt || now;
      entry.master.reviewedAt = now;
      entry.master.reviewedBy = req.user._id;
      // Make sure the entry is actually public
      entry.visibility = 'public';
    } else if (status === 'rejected') {
      entry.master.reviewedAt = now;
      entry.master.reviewedBy = req.user._id;
    } else if (status === 'none') {
      entry.master = { status: 'none' };
    }

    await entry.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/master/:id error:', err);
    res.status(500).json({ error: err.message || 'update_master_failed' });
  }
});

// ---------- Master List: Excel exports (in this file, no external router) ----------

// Public export: Approved only
app.get('/api/master/approved.xlsx', async (req, res) => {
  try {
    const entries = await fetchAndDecryptForExport({ 'master.status': 'approved' });
    const rows = rowsFromEntriesForExport(entries, { includeStatus: false });
    const fname = `master-approved-${new Date().toISOString().slice(0,10)}.xlsx`;
    return sendWorkbook(res, rows, fname);
  } catch (err) {
    console.error('GET /api/master/approved.xlsx error:', err);
    res.status(500).json({ error: err.message || 'export_failed' });
  }
});

// Admin export: status filter (all | pending | approved | rejected)
app.get('/api/master/export.xlsx', requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || 'all').toLowerCase();
    const allowed = ['pending', 'approved', 'rejected'];
    const statusQuery = status === 'all'
      ? { $in: allowed }
      : (allowed.includes(status) ? status : { $in: allowed });

    const entries = await fetchAndDecryptForExport({ 'master.status': statusQuery });
    const rows = rowsFromEntriesForExport(entries, { includeStatus: true });
    const fname = `master-${status}-${new Date().toISOString().slice(0,10)}.xlsx`;
    return sendWorkbook(res, rows, fname);
  } catch (err) {
    console.error('GET /api/master/export.xlsx error:', err);
    res.status(500).json({ error: err.message || 'export_failed' });
  }
});


// ---------- Stripe checkout ----------
app.post('/api/create-checkout-session', requireAuthOnly, async (req, res) => {
  try {
    await assertNotAlreadyPaid(req.user._id);

    let sessionUrl;

    try {
      const openSessions = await stripe.checkout.sessions.list({
        limit: 1,
        status: 'open',
        client_reference_id: String(req.user._id),
      });
      const existing = openSessions.data[0];
      if (existing && existing.url) {
        sessionUrl = existing.url;
        return res.json({ url: sessionUrl, reused: true });
      }
    } catch (err) {
      console.warn('[stripe] unable to reuse open session:', err.message);
    }

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: req.user.email,
        client_reference_id: String(req.user._id),
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: 'GematriaJourney Lifetime Membership' },
              unit_amount: 2000,
            },
            quantity: 1,
          },
        ],
        success_url: `${CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${CLIENT_URL}/payment-cancel`,
      },
      {
        idempotencyKey: `checkout:${req.user._id}:${Date.now() >> 12}`,
      }
    );

    res.json({ url: session.url });
  } catch (e) {
    const status = e.status || 500;
    res.status(status).json({ error: e.message || 'create_session_failed' });
  }
});

app.post('/api/stripe/confirm-session', requireAuthOnly, async (req, res) => {
  try {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['customer', 'payment_intent'],
    });

    const paid = session.payment_status === 'paid';
    if (!paid) return res.status(409).json({ error: 'payment_not_paid' });

    const ownerId = session.client_reference_id;
    const email = session.customer_details?.email || session.customer_email;

    let ok = false;
    if (ownerId && String(ownerId) === String(req.user._id)) ok = true;
    if (email && email === req.user.email) ok = true;

    if (!ok) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Session does not belong to current user',
      });
    }

    await User.findByIdAndUpdate(req.user._id, { isLifetime: true });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[stripe] confirm-session error:', e);
    res.status(500).json({ error: e.message });
  }
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

