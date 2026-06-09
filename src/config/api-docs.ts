export const apiDocs = {
  title: '数据要素流通平台 API 文档',
  version: '1.0.0',
  description: '面向数据提供方、使用方和平台运营人员的统一业务能力平台',
  basePath: '/api',
  authentication: {
    type: 'Bearer Token (JWT)',
    description: '在请求头中携带 Authorization: Bearer {token}',
  },
  userRoles: {
    PROVIDER: '数据提供方',
    CONSUMER: '数据使用方',
    ADMIN: '平台运营人员',
  },
  endpoints: [
    {
      category: '健康检查',
      apis: [
        { method: 'GET', path: '/health', description: '服务健康检查', auth: false },
      ],
    },
    {
      category: '用户认证',
      apis: [
        { method: 'POST', path: '/auth/login', description: '用户登录', auth: false },
        { method: 'POST', path: '/auth/register', description: '用户注册', auth: false },
        { method: 'GET', path: '/auth/profile', description: '获取当前用户信息', auth: true },
        { method: 'PUT', path: '/auth/profile', description: '更新个人资料', auth: true },
        { method: 'PUT', path: '/auth/password', description: '修改密码', auth: true },
      ],
    },
    {
      category: '数据产品',
      apis: [
        { method: 'GET', path: '/products', description: '产品列表（支持关键词、行业、地区、更新频率筛选）', auth: false },
        { method: 'GET', path: '/products/categories', description: '获取筛选条件（分类、行业、地区、更新频率）', auth: false },
        { method: 'GET', path: '/products/mine', description: '获取我的产品列表', auth: 'PROVIDER/ADMIN' },
        { method: 'GET', path: '/products/pending-review', description: '获取待审核产品列表', auth: 'ADMIN' },
        { method: 'GET', path: '/products/:id', description: '获取产品详情', auth: false },
        { method: 'GET', path: '/products/:id/sample', description: '查看产品样例数据', auth: false },
        { method: 'GET', path: '/products/:id/audit-logs', description: '获取产品审核记录', auth: 'PROVIDER/ADMIN' },
        { method: 'POST', path: '/products', description: '创建产品（上架草稿）', auth: 'PROVIDER/ADMIN' },
        { method: 'POST', path: '/products/:id/submit-review', description: '提交产品审核', auth: 'PROVIDER/ADMIN' },
        { method: 'PUT', path: '/products/:id', description: '更新产品信息', auth: 'PROVIDER/ADMIN' },
        { method: 'DELETE', path: '/products/:id', description: '删除产品', auth: 'PROVIDER/ADMIN' },
        { method: 'POST', path: '/products/:id/review', description: '审核产品（通过/拒绝）', auth: 'ADMIN' },
        { method: 'POST', path: '/products/:id/freeze', description: '冻结产品', auth: 'ADMIN' },
        { method: 'POST', path: '/products/:id/unfreeze', description: '解冻产品', auth: 'ADMIN' },
        { method: 'PUT', path: '/products/:id/visibility', description: '配置产品可见范围', auth: 'ADMIN' },
      ],
    },
    {
      category: '授权申请',
      apis: [
        { method: 'POST', path: '/authz/requests', description: '提交授权申请（含用途说明）', auth: 'CONSUMER/ADMIN' },
        { method: 'GET', path: '/authz/requests/mine', description: '获取我提交的授权申请列表', auth: true },
        { method: 'GET', path: '/authz/requests/received', description: '获取我收到的授权申请列表', auth: 'PROVIDER/ADMIN' },
        { method: 'GET', path: '/authz/requests/:id', description: '获取授权申请详情', auth: true },
        { method: 'POST', path: '/authz/requests/:id/approve', description: '审批通过授权申请', auth: 'PROVIDER/ADMIN' },
        { method: 'POST', path: '/authz/requests/:id/reject', description: '拒绝授权申请', auth: 'PROVIDER/ADMIN' },
        { method: 'POST', path: '/authz/requests/:id/revoke', description: '撤销已授权', auth: 'PROVIDER/ADMIN' },
      ],
    },
    {
      category: '合同管理',
      apis: [
        { method: 'GET', path: '/authz/contracts', description: '获取合同列表', auth: true },
        { method: 'GET', path: '/authz/contracts/:id', description: '获取合同详情', auth: true },
      ],
    },
    {
      category: '交付记录',
      apis: [
        { method: 'GET', path: '/deliveries', description: '获取交付记录列表', auth: true },
        { method: 'GET', path: '/deliveries/:id', description: '获取交付记录详情', auth: true },
        { method: 'GET', path: '/deliveries/:id/proof', description: '获取交付审计凭证', auth: true },
        { method: 'GET', path: '/deliveries/verify/:proofHash', description: '验证交付凭证（公开）', auth: false },
        { method: 'POST', path: '/deliveries', description: '创建交付记录', auth: 'PROVIDER/ADMIN' },
        { method: 'POST', path: '/deliveries/:id/deliver', description: '标记为已交付', auth: 'PROVIDER/ADMIN' },
        { method: 'POST', path: '/deliveries/:id/confirm', description: '使用方确认收货并生成审计凭证', auth: 'CONSUMER/ADMIN' },
      ],
    },
    {
      category: '评价与举报',
      apis: [
        { method: 'GET', path: '/reviews/product/:productId', description: '获取产品评价列表', auth: false },
        { method: 'GET', path: '/reviews/mine', description: '获取我的评价', auth: true },
        { method: 'POST', path: '/reviews', description: '发表评价', auth: 'CONSUMER/ADMIN' },
        { method: 'POST', path: '/reviews/:id/reply', description: '回复评价', auth: 'PROVIDER/ADMIN' },
        { method: 'DELETE', path: '/reviews/:id', description: '删除评价', auth: true },
        { method: 'GET', path: '/reports', description: '获取举报列表', auth: true },
        { method: 'GET', path: '/reports/:id', description: '获取举报详情', auth: true },
        { method: 'POST', path: '/reports', description: '提交违规举报', auth: true },
        { method: 'POST', path: '/reports/:id/handle', description: '处理举报', auth: 'ADMIN' },
      ],
    },
    {
      category: '运营统计',
      apis: [
        { method: 'GET', path: '/stats/overview', description: '平台运营概览统计', auth: 'ADMIN' },
        { method: 'GET', path: '/stats/trade', description: '交易数据统计（按日、分类、行业、地区）', auth: 'ADMIN' },
        { method: 'GET', path: '/stats/provider', description: '提供方数据统计', auth: 'PROVIDER/ADMIN' },
        { method: 'GET', path: '/stats/consumer', description: '使用方数据统计', auth: 'CONSUMER/ADMIN' },
        { method: 'GET', path: '/stats/activities', description: '最近活动列表', auth: 'ADMIN' },
      ],
    },
  ],
};
