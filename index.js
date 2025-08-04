import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import mysql from 'mysql2/promise';

dotenv.config();

const app = express();

// MySQL 연결 설정
let db;
async function connectDB() {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'fortune_statistics',
      port: process.env.DB_PORT || 3306
    });
    console.log('✅ MySQL 데이터베이스 연결 성공');
    
    // statistics 테이블 생성
    await createStatisticsTable();
  } catch (error) {
    console.error('❌ MySQL 연결 실패:', error.message);
  }
}

// statistics 테이블 생성
async function createStatisticsTable() {
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS statistics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        gender VARCHAR(10) NOT NULL,
        age_group VARCHAR(20) NOT NULL,
        mbti VARCHAR(4),
        service_type VARCHAR(20) NOT NULL,
        weekday VARCHAR(10) NOT NULL,
        time_period VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await db.execute(createTableSQL);
    console.log('✅ statistics 테이블 생성 완료');
  } catch (error) {
    console.error('❌ 테이블 생성 실패:', error.message);
  }
}

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 헬스체크 엔드포인트
app.get('/', (req, res) => {
  res.json({ 
    message: 'CLOVA OCR 서버가 정상적으로 실행 중입니다.',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 통계 데이터 저장 API
app.post('/api/statistics', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: '데이터베이스 연결이 없습니다.' });
    }

    const { gender, age_group, mbti, service_type, weekday, time_period } = req.body;

    // 필수 필드 검증
    if (!gender || !age_group || !service_type || !weekday || !time_period) {
      return res.status(400).json({ 
        error: '필수 필드가 누락되었습니다.' 
      });
    }

    const insertSQL = `
      INSERT INTO statistics (gender, age_group, mbti, service_type, weekday, time_period)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await db.execute(insertSQL, [gender, age_group, mbti, service_type, weekday, time_period]);
    
    res.json({ success: true, message: '통계 데이터가 저장되었습니다.' });
  } catch (error) {
    console.error('통계 저장 오류:', error);
    res.status(500).json({ error: '통계 저장 중 오류가 발생했습니다.' });
  }
});

// 통계 데이터 조회 API
app.get('/api/statistics', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: '데이터베이스 연결이 없습니다.' });
    }

    const [rows] = await db.execute('SELECT * FROM statistics ORDER BY created_at DESC');
    
    // 통계 계산
    const stats = calculateStatistics(rows);
    
    res.json({
      total_users: rows.length,
      ...stats
    });
  } catch (error) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
  }
});

// 통계 데이터 초기화 API
app.delete('/api/statistics', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: '데이터베이스 연결이 없습니다.' });
    }

    await db.execute('DELETE FROM statistics');
    
    res.json({ success: true, message: '모든 통계 데이터가 삭제되었습니다.' });
  } catch (error) {
    console.error('통계 초기화 오류:', error);
    res.status(500).json({ error: '통계 초기화 중 오류가 발생했습니다.' });
  }
});

// CSV 내보내기 API
app.get('/api/statistics/export', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: '데이터베이스 연결이 없습니다.' });
    }

    const [rows] = await db.execute('SELECT * FROM statistics ORDER BY created_at DESC');
    
    // CSV 헤더
    const csvHeader = 'ID,성별,연령대,MBTI,서비스유형,요일,시간대,생성일시\n';
    
    // CSV 데이터
    const csvData = rows.map(row => 
      `${row.id},${row.gender},${row.age_group},${row.mbti || ''},${row.service_type},${row.weekday},${row.time_period},${row.created_at}`
    ).join('\n');
    
    const csv = csvHeader + csvData;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="statistics_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('CSV 내보내기 오류:', error);
    res.status(500).json({ error: 'CSV 내보내기 중 오류가 발생했습니다.' });
  }
});

// 통계 계산 함수
function calculateStatistics(rows) {
  const stats = {
    gender_stats: { male: 0, female: 0 },
    age_stats: { '20대': 0, '30대': 0, '40대': 0, '50대+': 0 },
    mbti_stats: {},
    service_stats: { '운세': 0, '조력자': 0, '방해꾼': 0 },
    time_stats: { '오전': 0, '오후': 0, '저녁': 0 },
    weekday_stats: { '월요일': 0, '화요일': 0, '수요일': 0, '목요일': 0, '금요일': 0, '토요일': 0, '일요일': 0 }
  };

  rows.forEach(row => {
    // 성별 통계
    if (row.gender === '남성') stats.gender_stats.male++;
    else if (row.gender === '여성') stats.gender_stats.female++;

    // 연령대 통계
    if (stats.age_stats[row.age_group] !== undefined) {
      stats.age_stats[row.age_group]++;
    }

    // MBTI 통계
    if (row.mbti) {
      stats.mbti_stats[row.mbti] = (stats.mbti_stats[row.mbti] || 0) + 1;
    }

    // 서비스 통계
    if (stats.service_stats[row.service_type] !== undefined) {
      stats.service_stats[row.service_type]++;
    }

    // 시간대 통계
    if (stats.time_stats[row.time_period] !== undefined) {
      stats.time_stats[row.time_period]++;
    }

    // 요일 통계
    if (stats.weekday_stats[row.weekday] !== undefined) {
      stats.weekday_stats[row.weekday]++;
    }
  });

  return stats;
}

// CLOVA OCR 엔드포인트
app.post('/clova-ocr', async (req, res) => {
  try {
    const { base64Image } = req.body;

    // base64Image가 없으면 에러 반환
    if (!base64Image) {
      return res.status(400).json({ 
        error: 'base64Image가 필요합니다.' 
      });
    }

    // CLOVA OCR Secret 확인
    if (!process.env.CLOVA_OCR_SECRET) {
      console.error('CLOVA OCR Secret이 설정되지 않았습니다.');
      return res.status(500).json({ 
        error: '서버 설정 오류: CLOVA OCR Secret이 필요합니다.' 
      });
    }

    console.log('CLOVA OCR API 요청 시작...');

    const response = await axios.post(
      'https://f6oq8rjph7.apigw.ntruss.com/custom/v1/43607/c5ac14c78c057146887d11b5a4e9c0ad50c321faa6c3bf649e7beb6fc17ac8df/general',
      {
        images: [{ 
          format: 'jpg', 
          name: 'ocr_image', 
          data: base64Image 
        }],
        requestId: Date.now().toString(),
        version: 'V2',
        timestamp: Date.now()
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-OCR-SECRET': process.env.CLOVA_OCR_SECRET
        },
        timeout: 30000 // 30초 타임아웃
      }
    );

    console.log('CLOVA OCR API 응답 성공');
    res.json(response.data);

  } catch (err) {
    console.error('CLOVA OCR API 오류:', err?.response?.data || err.message);
    
    // CLOVA API 에러 응답 처리
    if (err.response) {
      const status = err.response.status;
      const errorData = err.response.data;
      
      return res.status(status).json({
        error: 'CLOVA OCR API 오류',
        details: errorData,
        status: status
      });
    }
    
    // 네트워크 오류 등
    res.status(500).json({ 
      error: 'OCR 처리 중 오류 발생',
      message: err.message 
    });
  }
});

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: '요청한 엔드포인트를 찾을 수 없습니다.' 
  });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);
  res.status(500).json({ 
    error: '서버 내부 오류가 발생했습니다.' 
  });
});

const PORT = process.env.PORT || 3000;

// 서버 시작 시 데이터베이스 연결
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 CLOVA OCR 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📝 OCR 엔드포인트: http://localhost:${PORT}/clova-ocr`);
    console.log(`📊 통계 API: http://localhost:${PORT}/api/statistics`);
    console.log(`🔍 헬스체크: http://localhost:${PORT}/`);
  });
}); 