import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import parkingRoutes from './routes/parking.routes';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/api', parkingRoutes);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}
