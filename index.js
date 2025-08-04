import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();

// Supabase 클라이언트 초기화
const supabaseUrl = 'https://qyqemkcwbapvsxblytln.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

// ===== 통계 API 엔드포인트들 =====

// 통계 데이터 저장
app.post('/api/statistics', async (req, res) => {
  try {
    const { gender, birth_date, time_slot, weekday, mbti, selected_service } = req.body;

    // 필수 필드 검증
    if (!gender || !birth_date || !time_slot || !weekday || !selected_service) {
      return res.status(400).json({
        error: '필수 필드가 누락되었습니다.',
        required: ['gender', 'birth_date', 'time_slot', 'weekday', 'selected_service']
      });
    }

    // Supabase에 데이터 저장
    const { data, error } = await supabase
      .from('statistics')
      .insert([{
        gender,
        birth_date,
        time_slot,
        weekday,
        mbti,
        selected_service
      }])
      .select();

    if (error) {
      console.error('Supabase 저장 오류:', error);
      return res.status(500).json({
        error: '통계 데이터 저장 실패',
        details: error.message
      });
    }

    console.log('통계 데이터 저장 성공:', data);
    res.status(201).json({
      success: true,
      message: '통계 데이터가 저장되었습니다.',
      data: data[0]
    });

  } catch (err) {
    console.error('통계 저장 API 오류:', err);
    res.status(500).json({
      error: '서버 내부 오류',
      message: err.message
    });
  }
});

// 통계 데이터 조회
app.get('/api/statistics', async (req, res) => {
  try {
    // 전체 통계 데이터 조회
    const { data, error } = await supabase
      .from('statistics')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase 조회 오류:', error);
      return res.status(500).json({
        error: '통계 데이터 조회 실패',
        details: error.message
      });
    }

    // 통계 계산
    const totalUsers = data.length;
    const genderStats = {};
    const ageStats = {};
    const mbtiStats = {};
    const serviceStats = {};
    const timeStats = {};
    const weekdayStats = {};

    data.forEach(item => {
      // 성별 통계
      genderStats[item.gender] = (genderStats[item.gender] || 0) + 1;
      
      // 연령대 통계 (생년월일에서 계산)
      const birthYear = new Date(item.birth_date).getFullYear();
      const currentYear = new Date().getFullYear();
      const age = currentYear - birthYear;
      let ageGroup = '50대+';
      if (age < 30) ageGroup = '20대';
      else if (age < 40) ageGroup = '30대';
      else if (age < 50) ageGroup = '40대';
      ageStats[ageGroup] = (ageStats[ageGroup] || 0) + 1;
      
      // MBTI 통계
      if (item.mbti) {
        mbtiStats[item.mbti] = (mbtiStats[item.mbti] || 0) + 1;
      }
      
      // 서비스 통계
      serviceStats[item.selected_service] = (serviceStats[item.selected_service] || 0) + 1;
      
      // 시간대 통계
      timeStats[item.time_slot] = (timeStats[item.time_slot] || 0) + 1;
      
      // 요일 통계
      weekdayStats[item.weekday] = (weekdayStats[item.weekday] || 0) + 1;
    });

    res.json({
      success: true,
      total_users: totalUsers,
      gender_stats: genderStats,
      age_stats: ageStats,
      mbti_stats: mbtiStats,
      service_stats: serviceStats,
      time_stats: timeStats,
      weekday_stats: weekdayStats,
      raw_data: data
    });

  } catch (err) {
    console.error('통계 조회 API 오류:', err);
    res.status(500).json({
      error: '서버 내부 오류',
      message: err.message
    });
  }
});

// 통계 데이터 초기화
app.delete('/api/statistics', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('statistics')
      .delete()
      .neq('id', 0); // 모든 데이터 삭제

    if (error) {
      console.error('Supabase 삭제 오류:', error);
      return res.status(500).json({
        error: '통계 데이터 초기화 실패',
        details: error.message
      });
    }

    console.log('통계 데이터 초기화 완료');
    res.json({
      success: true,
      message: '모든 통계 데이터가 초기화되었습니다.'
    });

  } catch (err) {
    console.error('통계 초기화 API 오류:', err);
    res.status(500).json({
      error: '서버 내부 오류',
      message: err.message
    });
  }
});

// CSV 내보내기
app.get('/api/statistics/export', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('statistics')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase 조회 오류:', error);
      return res.status(500).json({
        error: '데이터 조회 실패',
        details: error.message
      });
    }

    // CSV 헤더
    const csvHeaders = '성별,생년월일,시간대,요일,MBTI,선택서비스,생성일시\n';
    
    // CSV 데이터
    const csvData = data.map(item => {
      return `${item.gender},${item.birth_date},${item.time_slot},${item.weekday},${item.mbti || ''},${item.selected_service},${item.created_at}`;
    }).join('\n');

    const csvContent = csvHeaders + csvData;

    // CSV 파일 다운로드
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="statistics_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);

  } catch (err) {
    console.error('CSV 내보내기 오류:', err);
    res.status(500).json({
      error: 'CSV 내보내기 실패',
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
  console.log(`📊 통계 API 엔드포인트: http://localhost:${PORT}/api/statistics`);
  console.log(`🔍 헬스체크: http://localhost:${PORT}/`);
}); 