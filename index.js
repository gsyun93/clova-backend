import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();

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

    // 환경변수 확인
    if (!process.env.NAVER_CLOVA_CLIENT_ID || !process.env.NAVER_CLOVA_CLIENT_SECRET) {
      console.error('CLOVA API 키가 설정되지 않았습니다.');
      return res.status(500).json({ 
        error: '서버 설정 오류: CLOVA API 키가 필요합니다.' 
      });
    }

    console.log('CLOVA OCR API 요청 시작...');

    const response = await axios.post(
      'https://naveropenapi.apigw.ntruss.com/vision-ocr/v1/ocr',
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
          'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_CLOVA_CLIENT_ID,
          'X-NCP-APIGW-API-KEY': process.env.NAVER_CLOVA_CLIENT_SECRET
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

app.listen(PORT, () => {
  console.log(`🚀 CLOVA OCR 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📝 OCR 엔드포인트: http://localhost:${PORT}/clova-ocr`);
  console.log(`🔍 헬스체크: http://localhost:${PORT}/`);
}); 