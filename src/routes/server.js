import express from 'express';
import cors from 'cors';

// import your routes
import billingRoute from './billing.js';
import userRoute from './user.js';

const app = express();
app.use(cors());
app.use(express.json());

// mount the routes
app.use('/api/billing', billingRoute);
app.use('/api/user', userRoute);

// base route (optional)
app.get('/', (req, res) => {
  res.send('✅ Trading Core backend running');
});

// start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server ready on http://localhost:${PORT}`));
