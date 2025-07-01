# CLOVA OCR 백엔드 서버

네이버 CLOVA OCR API를 중계하는 Node.js 백엔드 서버입니다.

## 🚀 기능

- Base64 이미지를 받아서 CLOVA OCR API로 전송
- OCR 결과를 JSON 형태로 반환
- CORS 지원
- 에러 핸들링 및 로깅

## 📋 요구사항

- Node.js 18.0.0 이상
- 네이버 클라우드 플랫폼 CLOVA OCR API 키

## 🛠️ 설치 및 실행

### 1. 의존성 설치

```bash
cd clova-backend
npm install
```

### 2. 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# CLOVA OCR API 설정
NAVER_CLOVA_CLIENT_ID=발급받은_ID
NAVER_CLOVA_CLIENT_SECRET=발급받은_SECRET

# 서버 포트 설정 (Render에서는 자동으로 설정됨)
PORT=3000
```

### 3. 서버 실행

```bash
# 개발 모드 (파일 변경 시 자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

## 📡 API 엔드포인트

### POST /clova-ocr

OCR 처리를 위한 메인 엔드포인트입니다.

**요청 본문:**
```json
{
  "base64Image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
}
```

**응답 예시:**
```json
{
  "version": "V2",
  "requestId": "1234567890",
  "timestamp": 1234567890,
  "images": [
    {
      "uid": "0",
      "name": "ocr_image",
      "inferResult": "SUCCESS",
      "message": "SUCCESS",
      "fields": [
        {
          "name": "text",
          "boundingPoly": {
            "vertices": [
              {"x": 10, "y": 10},
              {"x": 100, "y": 10},
              {"x": 100, "y": 30},
              {"x": 10, "y": 30}
            ]
          },
          "inferText": "인식된 텍스트",
          "confidence": 0.99
        }
      ]
    }
  ]
}
```

### GET /

서버 상태 확인용 헬스체크 엔드포인트입니다.

**응답 예시:**
```json
{
  "message": "CLOVA OCR 서버가 정상적으로 실행 중입니다.",
  "status": "running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🌐 Render 배포

### 1. GitHub에 코드 푸시

```bash
git add .
git commit -m "Add CLOVA OCR backend server"
git push origin main
```

### 2. Render에서 새 서비스 생성

1. [Render](https://render.com)에 로그인
2. "New +" → "Web Service" 선택
3. GitHub 저장소 연결
4. 다음 설정으로 구성:
   - **Name**: clova-ocr-backend
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Root Directory**: `clova-backend`

### 3. 환경변수 설정

Render 대시보드에서 다음 환경변수를 설정하세요:

- `NAVER_CLOVA_CLIENT_ID`: 네이버 클라우드 플랫폼에서 발급받은 Client ID
- `NAVER_CLOVA_CLIENT_SECRET`: 네이버 클라우드 플랫폼에서 발급받은 Client Secret

## 🔧 CLOVA OCR API 키 발급 방법

1. [네이버 클라우드 플랫폼](https://www.ncloud.com/)에 가입
2. AI·NAVER API → CLOVA OCR 선택
3. 신청 후 승인되면 API 키 발급
4. 발급받은 Client ID와 Client Secret을 환경변수에 설정

## 📝 사용 예시

### JavaScript (Fetch API)

```javascript
const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...';

fetch('https://your-render-url.onrender.com/clova-ocr', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    base64Image: base64Image
  })
})
.then(response => response.json())
.then(data => {
  console.log('OCR 결과:', data);
})
.catch(error => {
  console.error('오류:', error);
});
```

### cURL

```bash
curl -X POST https://your-render-url.onrender.com/clova-ocr \
  -H "Content-Type: application/json" \
  -d '{
    "base64Image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
  }'
```

## ⚠️ 주의사항

- Base64 이미지 크기는 10MB 이하로 제한됩니다
- CLOVA OCR API는 유료 서비스입니다 (월 1,000건 무료)
- 이미지 형식은 JPG, PNG, BMP를 지원합니다
- API 응답 시간은 이미지 크기에 따라 달라질 수 있습니다

## 🐛 문제 해결

### 일반적인 오류

1. **401 Unauthorized**: API 키가 잘못되었거나 만료됨
2. **400 Bad Request**: base64Image가 누락되었거나 형식이 잘못됨
3. **413 Payload Too Large**: 이미지 크기가 10MB를 초과함
4. **500 Internal Server Error**: 서버 내부 오류

### 로그 확인

서버 로그를 확인하여 자세한 오류 정보를 확인할 수 있습니다.

## 📄 라이선스

MIT License 