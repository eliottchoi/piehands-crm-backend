# Contributing to Piehands CRM Backend

이 문서는 Piehands CRM 백엔드 프로젝트에 기여하는 방법을 설명합니다.

## 🚀 빠른 시작

### 개발 환경 설정
```bash
# 1. Repository 클론
git clone <repository-url>
cd backend

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일을 실제 값으로 수정

# 4. 데이터베이스 설정
npm run install:prisma-manual
npx prisma migrate dev

# 5. 개발 서버 실행
npm run dev
```

## 🌿 Git 워크플로우

### 브랜치 전략
우리는 **GitHub Flow**를 기반으로 한 브랜치 전략을 사용합니다:

- `main`: 배포 가능한 안정적인 코드
- `feature/*`: 새로운 기능 개발
- `bugfix/*`: 버그 수정
- `hotfix/*`: 긴급 수정

### 브랜치 네이밍 컨벤션
```
feature/[scope]/[description]
bugfix/[scope]/[description]
hotfix/[scope]/[description]
```

**스코프 예시:**
- `events-api` - 이벤트 수집 API
- `users` - 사용자 관리
- `templates` - 템플릿 시스템
- `campaigns` - 캠페인 관리
- `analytics` - 분석 시스템

**브랜치 예시:**
- `feature/events-api/batch-processing`
- `bugfix/sendgrid/webhook-validation`
- `hotfix/database/connection-pool`

### 개발 워크플로우

#### 1. 새 기능 개발 시작
```bash
# 최신 main 브랜치로 업데이트
git checkout main
git pull origin main

# 새 기능 브랜치 생성
git checkout -b feature/[scope]/[description]
```

#### 2. 개발 및 커밋
- 의미 있는 단위로 자주 커밋
- [Conventional Commits](#커밋-메시지-컨벤션) 형식 준수
- 각 커밋은 하나의 논리적 변경사항만 포함

#### 3. 테스트 및 품질 확인
```bash
# 린터 실행
npm run lint

# 타입 체크
npm run type-check

# 테스트 실행
npm run test
npm run test:e2e

# 빌드 확인
npm run build
```

#### 4. Pull Request 생성
- 의미 있는 PR 제목과 설명 작성
- [PR 템플릿](.github/pull_request_template.md) 활용
- 적절한 리뷰어 지정

#### 5. 코드 리뷰 및 병합
- 리뷰 피드백 반영
- 모든 CI 체크 통과 확인
- Squash merge로 병합
- 병합 후 feature 브랜치 삭제

## 📝 커밋 메시지 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 형식을 사용합니다:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### 커밋 타입
- `feat` - 새로운 기능
- `fix` - 버그 수정
- `docs` - 문서 업데이트
- `style` - 코드 포맷팅 (로직 변경 없음)
- `refactor` - 코드 리팩토링
- `test` - 테스트 코드 추가/수정
- `chore` - 빌드 프로세스, 패키지 매니저 설정 등
- `perf` - 성능 개선
- `ci` - CI/CD 설정 변경

### 예시
```bash
feat(events-api): add batch event processing endpoint
fix(sendgrid): resolve webhook signature validation issue
docs(api): update events API documentation
refactor(users): extract user validation logic
test(campaigns): add unit tests for campaign service
```

## 🧪 테스트 가이드라인

### 테스트 종류
1. **단위 테스트** (`*.spec.ts`) - 개별 함수/클래스 테스트
2. **통합 테스트** - 여러 컴포넌트 상호작용 테스트  
3. **E2E 테스트** (`*.e2e-spec.ts`) - 전체 API 엔드포인트 테스트

### 테스트 실행
```bash
# 모든 테스트
npm run test

# 특정 파일 테스트
npm run test -- users.service.spec.ts

# E2E 테스트
npm run test:e2e

# 커버리지 포함 테스트
npm run test:cov
```

### 테스트 작성 가이드
- **Given-When-Then** 패턴 사용
- 각 테스트는 하나의 동작만 검증
- Mock 사용시 실제 동작과 최대한 유사하게 구성
- 테스트 데이터는 각 테스트에서 독립적으로 관리

## 🔧 코드 스타일 가이드

### TypeScript 가이드라인
- `any` 타입 절대 금지
- 명시적 타입 선언 우선
- Interface over Type alias (복잡한 객체의 경우)
- Enum 대신 Union types 권장 (간단한 상수의 경우)

### NestJS 패턴
- Controller는 HTTP 관련 로직만 처리
- Service에서 비즈니스 로직 구현
- DTO를 통한 입력 검증 필수
- Dependency Injection 적극 활용

### 에러 처리
- HTTP 상태 코드 적절히 활용
- 사용자 친화적인 에러 메시지 제공
- 로깅을 통한 디버깅 정보 제공
- 민감한 정보 노출 방지

### 예시
```typescript
// ✅ 좋은 예
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(id: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Failed to find user ${id}:`, error);
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }
}

// ❌ 나쁜 예
async findUser(id: any): Promise<any> {
  return this.prisma.user.findUnique({ where: { id } });
}
```

## 📚 API 문서화

### OpenAPI/Swagger 문서화
- 모든 엔드포인트에 적절한 데코레이터 추가
- 요청/응답 스키마 명시
- 예시 요청/응답 포함
- 에러 응답도 문서화

### 예시
```typescript
@ApiTags('Events')
@Controller('events')
export class EventsController {
  @Post('track')
  @HttpCode(202)
  @ApiOperation({ summary: 'Track user event' })
  @ApiResponse({ status: 202, description: 'Event accepted for processing' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async track(@Body() dto: TrackEventDto) {
    // implementation
  }
}
```

## 🔍 코드 리뷰 가이드

### 리뷰어 체크리스트
- [ ] 기능이 요구사항을 충족하는가?
- [ ] 코드가 프로젝트 스타일을 준수하는가?
- [ ] 적절한 테스트가 포함되어 있는가?
- [ ] 성능상 문제는 없는가?
- [ ] 보안 이슈는 없는가?
- [ ] 문서화가 필요한 부분은 없는가?

### 피드백 가이드라인
- 건설적이고 구체적인 피드백 제공
- 문제점 지적시 개선 방안도 함께 제시
- 칭찬할 부분도 적극적으로 언급
- 논의가 필요한 부분은 직접 대화 권장

## 🚨 버그 리포트

### 버그 리포트 템플릿
```
**Bug Description**
버그에 대한 명확하고 간결한 설명

**Steps to Reproduce**
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
예상했던 동작에 대한 설명

**Actual Behavior**  
실제로 발생한 동작에 대한 설명

**Environment**
- OS: [e.g. Ubuntu 20.04]
- Node.js version: [e.g. 18.17.0]
- Database: [e.g. PostgreSQL 15]

**Additional Context**
추가적인 컨텍스트, 스크린샷, 로그 등
```

## 📖 추가 리소스

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)

## ❓ 질문이나 도움이 필요하신가요?

- GitHub Issues에 질문 등록
- 팀 슬랙 채널에서 논의
- 코드 리뷰 과정에서 멘토링 요청

우리는 모든 기여자를 환영하며, 함께 더 나은 코드를 만들어나가고 싶습니다! 🚀
