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

// 관리자 비밀번호 검증 API 엔드포인트
app.post('/validate-admin', async (req, res) => {
  try {
    const { password } = req.body;
    
    // 입력 데이터 검증
    if (!password) {
      return res.status(400).json({ error: '비밀번호가 필요합니다.' });
    }

    // 환경변수에서 관리자 비밀번호 가져오기
    const correctPassword = process.env.ADMIN_PASSWORD;
    
    if (!correctPassword) {
      console.error('관리자 비밀번호가 환경변수에 설정되지 않았습니다.');
      return res.status(500).json({ error: '서버 설정 오류' });
    }

    // 비밀번호 검증
    const isValid = password === correctPassword;
    
    console.log('관리자 비밀번호 검증:', { 
      input: password, 
      correct: correctPassword, 
      isValid: isValid 
    });

    res.json({ 
      isValid: isValid,
      message: isValid ? '비밀번호가 올바릅니다.' : '비밀번호가 틀렸습니다.'
    });

  } catch (error) {
    console.error('관리자 비밀번호 검증 오류:', error);
    res.status(500).json({ 
      error: '비밀번호 검증 중 오류 발생',
      message: error.message 
    });
  }
});

// 무의식 생성 API 엔드포인트
app.post('/generate-unconscious', async (req, res) => {
  try {
    const { birthdate, birthtime, mbti, gender } = req.body;
    
    // 입력 데이터 검증
    if (!birthdate) {
      return res.status(400).json({ error: '생년월일이 필요합니다.' });
    }

    // 무의식 프롬프트 생성
    const prompt = generateUnconsciousPrompt({ birthdate, birthtime, mbti, gender });
    
    console.log('무의식 생성 시작:', { birthdate, birthtime, mbti, gender });
    
    // OpenAI API 호출
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + gptApiKey
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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

    console.log('무의식 생성 성공');
    console.log('=== AI가 생성한 무의식 내용 ===');
    console.log(text);
    console.log('=== AI 응답 끝 ===');
    
    // 무의식 결과 파싱 및 반환
    const unconsciousResult = parseUnconsciousResult(text);
    console.log('=== 파싱된 무의식 결과 ===');
    console.log(unconsciousResult);
    console.log('=== 파싱 결과 끝 ===');
    
    res.json(unconsciousResult);

  } catch (error) {
    console.error('무의식 생성 오류:', error);
    res.status(500).json({ 
      error: '무의식 생성 중 오류 발생',
      message: error.message 
    });
  }
});

// 밸런스 생성 API 엔드포인트
app.post('/generate-balance', async (req, res) => {
  try {
    const { birthdate, birthtime, mbti, gender } = req.body;
    
    // 입력 데이터 검증
    if (!birthdate) {
      return res.status(400).json({ error: '생년월일이 필요합니다.' });
    }

    // 밸런스 프롬프트 생성
    const prompt = generateBalancePrompt({ birthdate, birthtime, mbti, gender });
    
    console.log('밸런스 생성 시작:', { birthdate, birthtime, mbti, gender });
    
    // OpenAI API 호출
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + gptApiKey
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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

    console.log('밸런스 생성 성공');
    console.log('=== AI가 생성한 밸런스 내용 ===');
    console.log(text);
    console.log('=== AI 응답 끝 ===');
    
    // 밸런스 결과 파싱 및 반환
    const balanceResult = parseBalanceResult(text);
    console.log('=== 파싱된 밸런스 결과 ===');
    console.log(balanceResult);
    console.log('=== 파싱 결과 끝 ===');
    
    res.json(balanceResult);

  } catch (error) {
    console.error('밸런스 생성 오류:', error);
    res.status(500).json({ 
      error: '밸런스 생성 중 오류 발생',
      message: error.message 
    });
  }
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
        model: "gpt-4o-mini",
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
    console.log('=== AI가 생성한 운세 내용 ===');
    console.log(text);
    console.log('=== AI 응답 끝 ===');
    
    // 운세 결과 파싱 및 반환
    const fortuneResult = parseFortuneResult(text);
    console.log('=== 파싱된 운세 결과 ===');
    console.log(fortuneResult);
    console.log('=== 파싱 결과 끝 ===');
    
    res.json(fortuneResult);

  } catch (error) {
    console.error('운세 생성 오류:', error);
    res.status(500).json({ 
      error: '운세 생성 중 오류 발생',
      message: error.message 
    });
  }
});

// 무의식 프롬프트 생성 함수
function generateUnconsciousPrompt(data) {
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

  return `당신은 사주, 띠, 별자리, MBTI에 통달한 직관력 있는 반말 운세 및 심리학 전문가입니다.
사용자가 입력한 정보의 사주, 띠, 별자리, MBTI를 분석해서 오늘 그가 가진 무의식의 모습을 구체적으로 분석해주세요.

사용자 정보:
- 성별: ${data.gender || '미입력'}
- 생년월일: ${data.birthdate}
- 출생시간: ${zodiacHour}
- 띠: ${zodiac}띠
- 별자리: ${starSign}
- MBTI: ${data.mbti || '미입력'}

다음 형식으로 **무조건 50자~60자로 상세한 이유를 갖춰** JSON 응답해주세요 (마크다운 코드 블록 없이 순수 JSON만):

예시:
오늘의 무의식: 불안한 도망자
무의식 해석: 겉으론 당당하지만, 속으론 책임을 피하고 싶은 마음이 강해질 수 있어
오늘의 메시지: 책임을 미루고 싶은 순간일수록, 작은 결단 하나가 내일의 안정을 만들어줄꺼야

{
  "unconscious_title": "구체적인 무의식 제목",
  "unconscious_interpretation": "마침표 없이 구체적인 무의식 해석 (50-60자)",
  "unconscious_message": "마침표 없이 구체적인 오늘의 메시지 (50-60자)"
}`;
}

// 밸런스 프롬프트 생성 함수
function generateBalancePrompt(data) {
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

  return `당신은 사주, 띠, 별자리, MBTI에 통달한 직관력 있는 반말 운세 및 심리학 전문가입니다.
사용자가 입력한 정보의 사주, 띠, 별자리, MBTI를 분석해서 오늘 하루의 일상 밸런스를 분석해주세요.

다음 **3가지 영역에 대해 100%를 분배**하여 사용자가 듣고싶어 할 재밌는 밸런스를 제안해주세요:
- 일 (업무, 공부, 목표 달성)
- 연애 (인간관계, 소통, 사랑)
- 휴식 (여가, 휴식, 자기계발)

조건:
- 연애와 휴식은 각각 30% 이상이 자주 나오도록 강조하세요
- 단, 아주 낮은 확률로 극단적인 밸런스(예: 일0% 연애0% 휴식100% 또는 일0% 연애65% 휴식35%)도 나오도록 허용하세요
- 해석과 주의사항은 가볍고 위트있게, 인스타 스토리에 공유하고 싶을 정도로 재밌게 표현하세요
- 결과는 매번 조금씩 달라지도록 랜덤성을 포함하세요

사용자 정보:
- 성별: ${data.gender || '미입력'}
- 생년월일: ${data.birthdate}
- 출생시간: ${zodiacHour}
- 띠: ${zodiac}띠
- 별자리: ${starSign}
- MBTI: ${data.mbti || '미입력'}

다음 형식으로 **무조건 35자~50자로 상세한 이유를 갖춰** JSON 응답해주세요 (마크다운 코드 블록 없이 순수 JSON만):

예시:
오늘의 밸런스: 일XX% 연애XX% 휴식XX%
밸런스 해석: 오늘은 XX이(가) 높으니 XX에 몰입하되 XX도 챙겨야 균형이 맞아
밸런스 주의사항: 지나친 XX 집중으로 피로 쌓이지 않게 XX으로 마음을 풀어줘야해

{
  "balance_title": "일XX% 연애XX% 휴식XX%",
  "balance_interpretation": "마침표 없이 구체적인 밸런스 해석 (35-50자)",
  "balance_message": "마침표 없이 구체적인 밸런스 주의사항 (35-50자)"
}`;
}

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

// 무의식 결과 파싱 함수
function parseUnconsciousResult(text) {
  const lines = text.split('\n').map(l => l.trim());
  
  // JSON 응답에서 직접 파싱 시도
  try {
    // 마크다운 코드 블록 제거
    let cleanText = text;
    if (cleanText.includes('```json')) {
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    if (cleanText.includes('```')) {
      cleanText = cleanText.replace(/```\n?/g, '');
    }
    
    const parsedResult = JSON.parse(cleanText);
    return parsedResult;
  } catch (parseError) {
    console.error('JSON 파싱 실패, 텍스트 블록 추출 시도:', parseError);
    
    // 텍스트 블록 추출으로 폴백
    return {
      unconscious_title: extractTextBlock(lines, 'unconscious_title:') || '불안한 도망자',
      unconscious_interpretation: extractTextBlock(lines, 'unconscious_interpretation:') || '겉으론 당당하지만, 속으론 책임을 피하고 싶은 마음이 강합니다.',
      unconscious_message: extractTextBlock(lines, 'unconscious_message:') || '책임을 미루고 싶은 순간일수록, 작은 결단 하나가 내일의 안정을 만들어줍니다.'
    };
  }
}

// 밸런스 결과 파싱 함수
function parseBalanceResult(text) {
  const lines = text.split('\n').map(l => l.trim());
  
  // JSON 응답에서 직접 파싱 시도
  try {
    // 마크다운 코드 블록 제거
    let cleanText = text;
    if (cleanText.includes('```json')) {
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    if (cleanText.includes('```')) {
      cleanText = cleanText.replace(/```\n?/g, '');
    }
    
    const parsedResult = JSON.parse(cleanText);
    return parsedResult;
  } catch (parseError) {
    console.error('JSON 파싱 실패, 텍스트 블록 추출 시도:', parseError);
    
    // 텍스트 블록 추출으로 폴백
    return {
      balance_title: extractTextBlock(lines, 'balance_title:') || '일60% 연애30% 휴식10%',
      balance_interpretation: extractTextBlock(lines, 'balance_interpretation:') || '오늘은 업무에 집중하되 인간관계도 소홀히 하지 마세요',
      balance_message: extractTextBlock(lines, 'balance_message:') || '과도한 일 집중으로 인한 스트레스에 주의하고 적절한 휴식을 취하세요'
    };
  }
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
    
    // CLOVA OCR 응답에서 텍스트 추출
    let ocrText = '';
    if (response.data && response.data.images && response.data.images.length > 0) {
        const image = response.data.images[0];
        if (image.fields) {
            // fields 배열에서 텍스트 추출
            ocrText = image.fields.map(field => field.inferText).join(' ');
        } else if (image.text) {
            // text 필드가 있는 경우
            ocrText = image.text;
        }
    }
    
    // 텍스트가 없으면 에러 반환
    if (!ocrText) {
        console.warn('CLOVA OCR에서 텍스트를 추출할 수 없습니다.');
        return res.status(400).json({
            error: 'OCR 결과에서 텍스트를 추출할 수 없습니다.',
            details: '이미지가 명확하지 않거나 OCR 인식에 실패했습니다.'
        });
    }
    
    console.log('추출된 OCR 텍스트:', ocrText);
    
    // 텍스트만 반환 (프론트엔드가 기대하는 형식)
    res.json({ text: ocrText });

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

// OCR 이탈 데이터 저장
app.post('/api/ocr-dropout', async (req, res) => {
  try {
    const { reason, timestamp } = req.body;
    
    // 입력 데이터 검증
    if (!reason) {
      return res.status(400).json({
        error: '이탈 이유가 필요합니다.',
        required: ['reason']
      });
    }

    console.log('OCR 이탈 데이터 저장 요청:', { reason, timestamp: timestamp || new Date().toISOString() });

    // Supabase에 OCR 이탈 데이터 저장
    const { data, error } = await supabase
      .from('ocr_dropouts')
      .insert([{
        reason
        // created_at은 자동으로 설정됨 (DEFAULT now())
      }])
      .select();

    if (error) {
      console.error('Supabase OCR 이탈 데이터 저장 오류:', error);
      return res.status(500).json({
        error: 'OCR 이탈 데이터 저장 실패',
        details: error.message
      });
    }

    console.log('OCR 이탈 데이터 저장 성공:', data);
    res.status(201).json({
      success: true,
      message: 'OCR 이탈 데이터가 저장되었습니다.',
      data: data[0]
    });

  } catch (err) {
    console.error('OCR 이탈 데이터 저장 API 오류:', err);
    res.status(500).json({
      error: '서버 내부 오류',
      message: err.message
    });
  }
});

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
    // 전체 통계 데이터 조회 (페이지네이션으로 모든 데이터 가져오기)
    let allData = [];
    let currentPage = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = currentPage * pageSize;
      const to = (currentPage + 1) * pageSize - 1;
      
      const { data, error } = await supabase
        .from('statistics')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Supabase 조회 오류:', error);
        return res.status(500).json({
          error: '통계 데이터 조회 실패',
          details: error.message
        });
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        hasMore = data.length === pageSize;
        currentPage++;
        console.log(`페이지 ${currentPage}: ${data.length}개 데이터 로드됨 (총 ${allData.length}개)`);
      } else {
        hasMore = false;
      }
    }

    console.log(`전체 통계 데이터 로드 완료: ${allData.length}개`);
    const data = allData;

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

    // OCR 이탈률 계산 (데일리)
    // AI 컨텐츠 선택 횟수 (운세, 무의식, 밸런스) - 오늘만
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    
    // 오늘 AI 컨텐츠 선택 횟수 계산
    const todayAiContentSelections = data.filter(item => {
      const itemDate = new Date(item.created_at);
      return itemDate >= new Date(todayStart) && itemDate < new Date(todayEnd) &&
             ['운세', '무의식', '밸런스'].includes(item.selected_service);
    }).length;
    
    // 오늘 OCR 이탈 횟수 조회
    let todayOcrDropouts = 0;
    try {
      const { data: dropoutData, error: dropoutError } = await supabase
        .from('ocr_dropouts')
        .select('*')
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd);
      
      if (!dropoutError && dropoutData) {
        todayOcrDropouts = dropoutData.length;
        console.log('오늘 OCR 이탈 데이터:', todayOcrDropouts, '건');
      }
    } catch (dropoutErr) {
      console.error('OCR 이탈 데이터 조회 오류:', dropoutErr);
    }
    
    // OCR 이탈률 계산 (퍼센트) - 오늘만
    const ocrDropoutRate = todayAiContentSelections > 0 ? Math.round((todayOcrDropouts / todayAiContentSelections) * 100) : 0;
    
    console.log('데일리 OCR 이탈률 계산:', {
      todayAiContentSelections,
      todayOcrDropouts,
      ocrDropoutRate: ocrDropoutRate + '%'
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
      ocr_dropout_rate: ocrDropoutRate,
      ocr_dropout_count: todayOcrDropouts,
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

// 수동 데이터 정리 API (관리자용)
app.post('/api/cleanup', async (req, res) => {
  try {
    const { password } = req.body;
    
    // 관리자 비밀번호 검증
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({
        error: '관리자 권한이 필요합니다.'
      });
    }
    
    console.log('수동 데이터 정리 요청됨');
    await cleanupOldData();
    
    res.json({
      success: true,
      message: '데이터 정리가 완료되었습니다.',
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('수동 데이터 정리 오류:', err);
    res.status(500).json({
      error: '데이터 정리 중 오류 발생',
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

// ===== OCR 이탈률 데일리 자동 정리 =====

// 매일 자정에 OCR 이탈 데이터만 삭제 (다른 통계는 누적 유지)
function scheduleDailyCleanup() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const timeUntilMidnight = tomorrow.getTime() - now.getTime();
  
  // 자정까지 대기 후 실행
  setTimeout(async () => {
    await cleanupOldData();
    // 이후 24시간마다 반복
    setInterval(cleanupOldData, 24 * 60 * 60 * 1000);
  }, timeUntilMidnight);
  
  console.log('OCR 이탈률 데일리 정리 스케줄 설정 완료');
}

// 이전 날짜 데이터 삭제 함수 (OCR 이탈 데이터만)
async function cleanupOldData() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
    
    console.log('OCR 이탈 데이터 데일리 정리 시작:', yesterdayStart);
    
    // OCR 이탈 데이터만 어제 데이터 삭제 (ocr_dropouts 테이블)
    const { error: dropoutError } = await supabase
      .from('ocr_dropouts')
      .delete()
      .lt('created_at', yesterdayStart);
    
    if (dropoutError) {
      console.error('ocr_dropouts 테이블 정리 오류:', dropoutError);
    } else {
      console.log('ocr_dropouts 테이블 어제 데이터 삭제 완료');
    }
    
    // statistics 테이블은 누적 데이터로 유지 (삭제하지 않음)
    console.log('statistics 테이블은 누적 데이터로 유지됨');
    
    console.log('OCR 이탈 데이터 데일리 정리 완료');
    
  } catch (error) {
    console.error('OCR 이탈 데이터 정리 중 오류:', error);
  }
}

// 서버 시작 시 스케줄 설정
scheduleDailyCleanup();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 CLOVA OCR 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📝 OCR 엔드포인트: http://localhost:${PORT}/clova-ocr`);
  console.log(`📊 통계 API 엔드포인트: http://localhost:${PORT}/api/statistics`);
  console.log(`🔍 헬스체크: http://localhost:${PORT}/`);
  console.log(`🧹 OCR 이탈률 데일리 자동 정리 활성화됨 (다른 통계는 누적 유지)`);
}); 