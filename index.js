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

// 환경변수에서 API 키 가져오기
const gptApiKey = process.env.GPT_API_KEY;
const clovaSecret = process.env.CLOVA_OCR_SECRET;
const adminPassword = process.env.ADMIN_PASSWORD;

// API 키 검증
if (!gptApiKey) {
    console.error('❌ GPT API 키가 설정되지 않았습니다.');
    console.error('📝 환경변수 GPT_API_KEY를 설정해주세요.');
    process.exit(1);
}

if (!clovaSecret) {
    console.error('❌ CLOVA OCR Secret이 설정되지 않았습니다.');
    console.error('📝 환경변수 CLOVA_OCR_SECRET을 설정해주세요.');
    process.exit(1);
}

console.log('✅ 모든 API 키가 정상적으로 설정되었습니다.');

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

// 운세 생성 API 엔드포인트
app.post('/generate-fortune', async (req, res) => {
  try {
    const { birthdate, birthtime, mbti, gender } = req.body;
    
    // 입력 데이터 검증
    if (!birthdate) {
      return res.status(400).json({ error: '생년월일이 필요합니다.' });
    }

    // 운세 프롬프트 생성
    const prompt = generateFortunePrompt({ birthdate, birthtime, mbti, gender });
    
    console.log('운세 생성 시작:', { birthdate, birthtime, mbti, gender });
    
    // OpenAI API 호출
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + gptApiKey
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API 오류 응답:', errorText);
      throw new Error(`OpenAI API 호출 실패: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';
    
    if (!text) {
      throw new Error('OpenAI 응답이 비어있습니다');
    }

    console.log('운세 생성 성공');
    
    // 운세 결과 파싱 및 반환
    const fortuneResult = parseFortuneResult(text);
    res.json(fortuneResult);

  } catch (error) {
    console.error('운세 생성 오류:', error);
    res.status(500).json({ 
      error: '운세 생성 중 오류 발생',
      message: error.message 
    });
  }
});

// 운세 프롬프트 생성 함수
function generateFortunePrompt(data) {
  const birthdate = data.birthdate;
  const year = parseInt(birthdate.substring(0, 4));
  const month = parseInt(birthdate.substring(4, 6));
  const day = parseInt(birthdate.substring(6, 8));

  const zodiac = calculateZodiac(year);
  const starSign = calculateStarSign(month, day);
  
  // 출생시간이 있는 경우 지지 계산
  let zodiacHour = '입력되지 않음';
  if (data.birthtime) {
    const [hour, minute] = data.birthtime.split(':');
    zodiacHour = calculateZodiacHour(parseInt(hour), parseInt(minute || '0'));
  }

  return `
당신은 사주, 띠, 별자리, MBTI에 통달한 직관력 있는 반말 운세 전문가입니다.
오늘 하루, 사용자의 정보를 바탕으로 신뢰감 있으면서도 행동을 지시하는 운세를 반말로 제시해주세요.
운세 요약은 띠, 별자리, 사주 분석을 바탕으로 정리하되,
사용자가 오늘 하루를 기대하게 만들 수 있는 따뜻하고 설득력 있는 문장으로 구성해 주세요 (문장 내 ; 사용 금지).

[운세 요약 생성 요청]
- 출력 형식: **딱 1문장, 35~45자 사이의 자연스러운 한 문장**
- 반드시 포함: 지지(80%), 별자리(10%), 띠(10%) 중 하나를 포함하여 문장 생성
- 문체: 신뢰감 있으면서도 예측 불가능한 표현 사용
- 분위기: 따뜻한 듯하면서도 소름 돋고, 조용한 흥분과 기대가 느껴지게
- 목적: 읽는 사람이 행동하게 만들 것. 단순한 위로 금지.

예시)
- 천칭자리는 오늘 익숙한 공간 안에서 낯선 기운을 느끼게 돼, 이상해도 한 발 더 다가가야 해  
- 자시에 태어난 너는 오늘 오후 느닷없는 침묵을 마주치게 돼, 그 순간 눈을 피하지 마 
- 말띠는 오늘 거리에서 마주치는 우연에 기대 이상의 의미가 담겨 있어, 그걸 그냥 지나치지 마

${data.mbti ? `[MBTI 처방전 요청]
- 출력 형식: **딱 1문장, 35~45자 사이의 자연스러운 한 문장**
- 반드시 포함: MBTI 유형 + 실행 유도 행동 제안
- 문체: 마치 친한 AI가 속삭이듯, 부드럽지만 명확하게
- 목적: 오늘 하루를 구체적으로 움직이게 만드는 실용적 제안
- 뻔한 성격 분석, 일반 조언 금지

예시)
- ENFP는 오늘 묘하게 끌리는 장소가 생긴다면 절대 망설이지 말고 그곳으로 발걸음을 옮겨야 해  
- INTJ는 오늘 타인의 무심한 말에 잠시 흔들릴 수도 있어, 괜찮아, 지금은 혼자 생각할 시간이 필요해` : ''}

사용자 정보:
성별: ${data.gender || '입력되지 않음'}
생년월일: ${data.birthdate}
출생시간: ${zodiacHour}
띠: ${zodiac}띠
별자리: ${starSign}
${data.mbti ? `MBTI: ${data.mbti}` : ''}

[출력 형식]
운세 요약: 위에서 제시한 조건에 맞춰 운세 요약을 생성해주세요.
${data.mbti ? 'MBTI 처방전: 위에서 제시한 조건에 맞춰 MBTI 처방전을 생성해주세요.' : ''}`;
}

// 운세 결과 파싱 함수
function parseFortuneResult(text) {
  const lines = text.split('\n').map(l => l.trim());
  
  // 확률 기반으로 점수 생성
  const scores = {
    money: generateRandomScore(),
    love: generateRandomScore(),
    career: generateRandomScore(),
    health: generateRandomScore()
  };

  // 종합 지수 계산 (단순 평균)
  const totalScore = Math.round(
    (scores.money + scores.love + scores.career + scores.health) / 4
  );

  return {
    money: scores.money,
    love: scores.love,
    career: scores.career,
    health: scores.health,
    total: totalScore,
    fortune: extractTextBlock(lines, '운세 요약:') || '오늘은 좋은 일이 가득할 것입니다.',
    mbtiTip: extractTextBlock(lines, 'MBTI 처방전:') || 'MBTI 특성을 살려 오늘 하루를 보내세요.'
  };
}

// 확률 기반 점수 생성 함수
function generateRandomScore() {
  const random = Math.random() * 100;
  
  if (random < 8) return Math.floor(Math.random() * 6) + 95;    // 95-100점: 8%
  if (random < 25) return Math.floor(Math.random() * 5) + 90;   // 90-94점: 17%
  if (random < 65) return Math.floor(Math.random() * 10) + 80;  // 80-89점: 40%
  if (random < 80) return Math.floor(Math.random() * 5) + 75;   // 75-79점: 15%
  if (random < 90) return Math.floor(Math.random() * 10) + 70;  // 70-79점: 10%
  if (random < 98) return Math.floor(Math.random() * 10) + 60;  // 60-69점: 8%
  return Math.floor(Math.random() * 10) + 50;                  // 50-59점: 2%
}

// 텍스트 블록 추출 함수
function extractTextBlock(lines, label) {
  const startIndex = lines.findIndex(line => line.includes(label));
  if (startIndex === -1) return '';
  
  const text = lines[startIndex].replace(label, '').trim();
  return text;
}

// 띠 계산 함수
function calculateZodiac(year) {
  const zodiacSigns = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  return zodiacSigns[(year - 4) % 12];
}

// 별자리 계산 함수
function calculateStarSign(month, day) {
  const starSigns = [
    { name: '물병자리', start: [1, 20], end: [2, 18] },
    { name: '물고기자리', start: [2, 19], end: [3, 20] },
    { name: '양자리', start: [3, 21], end: [4, 19] },
    { name: '황소자리', start: [4, 20], end: [5, 20] },
    { name: '쌍둥이자리', start: [5, 21], end: [6, 21] },
    { name: '게자리', start: [6, 22], end: [7, 22] },
    { name: '사자자리', start: [7, 23], end: [8, 22] },
    { name: '처녀자리', start: [8, 23], end: [9, 22] },
    { name: '천칭자리', start: [9, 23], end: [10, 22] },
    { name: '전갈자리', start: [10, 23], end: [11, 21] },
    { name: '사수자리', start: [11, 22], end: [12, 21] },
    { name: '염소자리', start: [12, 22], end: [1, 19] }
  ];

  for (const sign of starSigns) {
    if (isInDateRange(month, day, sign.start, sign.end)) {
      return sign.name;
    }
  }
  return '물병자리';
}

// 날짜 범위 확인 함수
function isInDateRange(month, day, start, end) {
  const current = month * 100 + day;
  const startDate = start[0] * 100 + start[1];
  const endDate = end[0] * 100 + end[1];

  if (startDate <= endDate) {
    return current >= startDate && current <= endDate;
  } else {
    return current >= startDate || current <= endDate;
  }
}

// 시간대별 별자리 계산 함수
function calculateZodiacHour(hour, minute) {
  const timeSlots = [
    { name: '자시(子時)', start: 23, end: 1 },
    { name: '축시(丑時)', start: 1, end: 3 },
    { name: '인시(寅時)', start: 3, end: 5 },
    { name: '묘시(卯時)', start: 5, end: 7 },
    { name: '진시(辰時)', start: 7, end: 9 },
    { name: '사시(巳時)', start: 9, end: 11 },
    { name: '오시(午時)', start: 11, end: 13 },
    { name: '미시(未時)', start: 13, end: 15 },
    { name: '신시(申時)', start: 15, end: 17 },
    { name: '유시(酉時)', start: 17, end: 19 },
    { name: '술시(戌時)', start: 19, end: 21 },
    { name: '해시(亥時)', start: 21, end: 23 }
  ];

  for (const slot of timeSlots) {
    if (hour >= slot.start && hour < slot.end) {
      return slot.name;
    }
  }
  return '자시(子時)';
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
    if (!clovaSecret) {
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
          'X-OCR-SECRET': clovaSecret
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
      if (age < 20) ageGroup = '10대';
      else if (age < 30) ageGroup = '20대';
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