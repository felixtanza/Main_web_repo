require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const nodemailer = require('nodemailer');

const User = require('./models/User');
const Transaction = require('./models/Transaction');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== MIDDLEWARE ==================== //
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'tanfel_secret',
  resave: false,
  saveUninitialized: true,
}));

// ==================== VIEW ENGINE ==================== //
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// ==================== DB CONNECTION ==================== //
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB error:', err));

// ==================== ROUTES ==================== //

// Landing Page
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/menu');
  res.render('index', { error: null });
});

// Register Page
app.get('/register', (req, res) => res.render('register', { error: null }));

// Handle User Registration
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.render('register', { error: 'All fields are required' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.render('register', { error: 'Email already exists' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashed });
  await user.save();
  res.redirect('/');
});

// Handle Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render('index', { error: 'Both email and password are required' });
  }

  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user._id;
    return res.redirect('/menu');
  }

  res.render('index', { error: 'Invalid email or password' });
});

// Menu Page
app.get('/menu', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.render('menu');
});

// Checkout Page
app.get('/checkout', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.render('checkout', { error: null });
});

// ==================== PAYMENT ==================== //

app.post('/pay', async (req, res) => {
  const { phone, cart, total } = req.body;

  if (!phone || !cart || !total) {
    return res.render('checkout', { error: 'All fields are required' });
  }

  req.session.pendingOrder = { phone, cart, total };

  try {
    const auth = Buffer.from(`${process.env.DARAJA_KEY}:${process.env.DARAJA_SECRET}`).toString('base64');
    const tokenRes = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const token = tokenRes.data.access_token;

    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password = Buffer.from(
      `${process.env.DARAJA_SHORTCODE}${process.env.DARAJA_PASSKEY}${timestamp}`
    ).toString('base64');

    await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: process.env.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: total,
        PartyA: phone,
        PartyB: process.env.DARAJA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: `${process.env.BASE_URL}/mpesa/callback`,
        AccountReference: "Tanfel",
        TransactionDesc: "Food Order",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    res.redirect('/success');

  } catch (err) {
    console.error('❌ Payment error:', err.message);
    res.render('checkout', { error: 'Payment initiation failed. Try again.' });
  }
});

// ==================== M-PESA CALLBACK ==================== //

app.post('/mpesa/callback', async (req, res) => {
  const callback = req.body.Body.stkCallback;

  if (callback.ResultCode === 0) {
    const metadata = callback.CallbackMetadata.Item.reduce((acc, item) => {
      acc[item.Name] = item.Value;
      return acc;
    }, {});

    const { phone, cart, total } = req.session?.pendingOrder || {};

    const transaction = new Transaction({
      phone: metadata.PhoneNumber,
      amount: metadata.Amount,
      mpesaReceiptNumber: metadata.MpesaReceiptNumber,
      transactionDate: metadata.TransactionDate,
      user: req.session.userId,
      cart,
    });

    await transaction.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: 'New Tanfel Hotel Order',
      html: `
        <p><strong>Phone:</strong> ${metadata.PhoneNumber}</p>
        <p><strong>Total:</strong> ${metadata.Amount}</p>
        <p><strong>Order:</strong> ${JSON.stringify(cart)}</p>
      `,
    });

    console.log('✅ Payment saved:', transaction);
  } else {
    console.log('❌ STK Push Failed:', callback.ResultDesc);
  }

  res.sendStatus(200);
});

// ==================== ORDERS ==================== //

app.get('/orders', async (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  const totalOrders = await Transaction.countDocuments({ user: req.session.userId });
  const orders = await Transaction.find({ user: req.session.userId })
    .sort({ transactionDate: -1 })
    .skip(skip)
    .limit(limit);

  const totalPages = Math.ceil(totalOrders / limit);
  res.render('orders', { orders, page, totalPages });
});

// Receipt Page
app.get('/receipt/:id', async (req, res) => {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    user: req.session.userId,
  });

  if (!transaction) return res.render('error', { error: 'Receipt not found' });
  res.render('receipt', { transaction });
});

// ==================== MISC ==================== //

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/success', (req, res) => res.render('success'));
app.get('/error', (req, res) => res.render('error', { error: 'Something went wrong' }));

// ==================== START SERVER ==================== //

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
