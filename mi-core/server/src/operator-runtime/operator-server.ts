import express from 'express';
import { operatorRuntimeRouter } from '../routes/operator-runtime';

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/', operatorRuntimeRouter);

const PORT = 7788;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[operator-runtime] listening on ${PORT}`);
});
