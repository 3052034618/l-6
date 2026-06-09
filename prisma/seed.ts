import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      fullName: '系统管理员',
      role: 'ADMIN',
      organization: '数据交易平台运营中心',
      phone: '13800000000',
    },
  });

  const provider = await prisma.user.upsert({
    where: { username: 'provider1' },
    update: {},
    create: {
      username: 'provider1',
      email: 'provider1@example.com',
      password: hashedPassword,
      fullName: '数据提供商A',
      role: 'PROVIDER',
      organization: '某某数据科技有限公司',
      phone: '13800000001',
    },
  });

  const consumer = await prisma.user.upsert({
    where: { username: 'consumer1' },
    update: {},
    create: {
      username: 'consumer1',
      email: 'consumer1@example.com',
      password: hashedPassword,
      fullName: '数据使用方B',
      role: 'CONSUMER',
      organization: '某某科技应用公司',
      phone: '13800000002',
    },
  });

  const productsData = [
    {
      id: 'product-1',
      title: '全国人口统计数据集',
      description: '包含全国各省市人口统计数据，包括年龄分布、性别比例、教育水平等多维度数据。数据来源于官方统计年鉴，经过清洗和标准化处理。',
      category: '人口统计',
      industry: '政府公共',
      region: '全国',
      updateFrequency: 'YEARLY',
      dataVolume: '500万条',
      dataFormat: 'CSV/JSON',
      pricingModel: '一次性购买',
      price: 9999,
      priceUnit: '元/套',
      sampleData: '[{"省份":"北京市","人口数量":21893095,"男性占比":51.2,"女性占比":48.8}]',
      tags: JSON.stringify(['人口', '统计', '全国', '宏观']),
      status: 'APPROVED',
      isPublic: true,
      ratingAvg: 4.5,
      reviewCount: 3,
      viewCount: 256,
      publishedAt: new Date(),
    },
    {
      id: 'product-2',
      title: '金融行业信贷风险数据',
      description: '基于多维度数据构建的信贷风险评估数据集，包含个人和企业信用评分、违约概率预测等数据。',
      category: '金融数据',
      industry: '金融',
      region: '华东地区',
      updateFrequency: 'MONTHLY',
      dataVolume: '200万条',
      dataFormat: 'JSON/API',
      pricingModel: '订阅制',
      price: 1999,
      priceUnit: '元/月',
      sampleData: '[{"用户ID":"U001","信用评分":720,"违约概率":0.023,"风险等级":"低"}]',
      tags: JSON.stringify(['金融', '风控', '信贷', '评分']),
      status: 'APPROVED',
      isPublic: true,
      ratingAvg: 4.2,
      reviewCount: 5,
      viewCount: 512,
      publishedAt: new Date(),
    },
    {
      id: 'product-3',
      title: '电商用户行为分析数据',
      description: '电商平台用户浏览、购买、收藏等行为数据，支持用户画像构建和精准营销。',
      category: '用户行为',
      industry: '电商',
      region: '华南地区',
      updateFrequency: 'DAILY',
      dataVolume: '5000万条/日',
      dataFormat: 'CSV/Parquet',
      pricingModel: '按量付费',
      price: 0.5,
      priceUnit: '元/千条',
      sampleData: '[{"用户ID":"U10001","商品ID":"P5001","行为类型":"浏览","时长":120,"时间":"2024-01-15 10:30:00"}]',
      tags: JSON.stringify(['电商', '用户行为', '营销', '画像']),
      status: 'APPROVED',
      isPublic: true,
      ratingAvg: 4.8,
      reviewCount: 8,
      viewCount: 1024,
      publishedAt: new Date(),
    },
    {
      id: 'product-4',
      title: '智慧城市交通流量数据',
      description: '城市主要道路实时交通流量数据，包含车流量、平均车速、拥堵指数等指标。',
      category: '交通出行',
      industry: '智慧城市',
      region: '北京市',
      updateFrequency: 'REAL_TIME',
      dataVolume: '实时更新',
      dataFormat: 'API',
      pricingModel: '订阅制',
      price: 5999,
      priceUnit: '元/月',
      sampleData: '[{"路段ID":"R001","路段名称":"长安街","车流量":1560,"平均车速":35,"拥堵指数":0.7}]',
      tags: JSON.stringify(['交通', '智慧城市', '实时', 'IoT']),
      status: 'PENDING_REVIEW',
      isPublic: true,
      ratingAvg: 0,
      reviewCount: 0,
      viewCount: 50,
      publishedAt: null,
    },
    {
      id: 'product-5',
      title: '医疗健康匿名化数据集',
      description: '经过严格匿名化处理的医疗健康数据，包含疾病诊断、用药记录、体检数据等，支持医学研究和新药研发。',
      category: '医疗健康',
      industry: '医疗',
      region: '上海市',
      updateFrequency: 'QUARTERLY',
      dataVolume: '100万条',
      dataFormat: 'CSV',
      pricingModel: '一次性购买',
      price: 29999,
      priceUnit: '元/套',
      sampleData: '[{"患者ID":"P00001","年龄段":"30-39","性别":"男","诊断":"高血压","用药":"硝苯地平"}]',
      tags: JSON.stringify(['医疗', '健康', '研究', '匿名化']),
      status: 'PENDING_REVIEW',
      isPublic: true,
      ratingAvg: 0,
      reviewCount: 0,
      viewCount: 30,
      publishedAt: null,
    },
  ];

  for (const product of productsData) {
    await prisma.dataProduct.upsert({
      where: { id: product.id },
      update: {},
      create: {
        ...product,
        providerId: provider.id,
      },
    });
  }

  console.log('Seed data created successfully!');
  console.log('Admin user: admin / 123456');
  console.log('Provider user: provider1 / 123456');
  console.log('Consumer user: consumer1 / 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
