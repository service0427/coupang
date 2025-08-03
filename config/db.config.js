// 데이터베이스 설정
module.exports = {
  // 운영 데이터베이스 설정
  production: {
    host: process.env.DB_HOST || 'mkt.techb.kr',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'coupang_test',
    user: process.env.DB_USER || 'techb_pp',
    password: process.env.DB_PASSWORD || 'Tech1324!',
    max: 20, // 최대 연결 수
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: false // 필요시 SSL 설정
  },

  // 개발용 설정 (로컬 DB가 있다면)
  development: {
    host: process.env.DEV_DB_HOST || 'localhost',
    port: process.env.DEV_DB_PORT || 5432,
    database: process.env.DEV_DB_NAME || 'coupang_dev',
    user: process.env.DEV_DB_USER || 'postgres',
    password: process.env.DEV_DB_PASSWORD || '',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: false
  },

  // 현재 환경
  current: function() {
    const env = process.env.NODE_ENV || 'production';
    return this[env] || this.production;
  }
};