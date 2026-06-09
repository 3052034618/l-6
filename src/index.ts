import express from 'express';
import cors from 'cors';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`
========================================
  数据要素流通平台后端服务已启动
  环境: ${config.nodeEnv}
  端口: ${config.port}
  地址: http://localhost:${config.port}
  API前缀: /api
========================================
  `);
});

export default app;
