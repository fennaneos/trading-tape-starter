import express from 'express';
import cors from 'cors';

// import your routes
import billingRoute from './billing.js';
import userRoute from './user.js';

import backtestRoute from './routes/backtest.js';


const app = express();
app.use(cors());
app.use(express.json());


import ordersRoute from "./routes/orders.js"; // <— path above
app.use("/api/orders", ordersRoute);


// mount the routes
app.use('/api/billing', billingRoute);
app.use('/api/user', userRoute);
app.use('/api/backtest', backtestRoute);

// server/index.js  (or wherever you configure routes)
import strategyRoute from './routes/strategy.js';
app.use('/api/strategy', strategyRoute);


// base route (optional)
app.get('/', (req, res) => {
  res.send('✅ Trading Core backend running');
});

// start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server ready on http://localhost:${PORT}`));

