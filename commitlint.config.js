module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 새로운 기능 추가
        'fix',      // 버그 수정
        'docs',     // 문서 업데이트
        'style',    // 코드 스타일링
        'refactor', // 코드 리팩토링
        'test',     // 테스트 코드
        'chore',    // 빌드/설정 변경
        'perf',     // 성능 개선
        'ci',       // CI/CD 설정
        'revert',   // 커밋 되돌리기
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'events-api',    // 이벤트 수집 시스템
        'users',         // 사용자 관리
        'templates',     // 템플릿 관리
        'campaigns',     // 캠페인 관리
        'analytics',     // 분석 및 리포팅
        'sendgrid',      // SendGrid 통합
        'webhooks',      // 웹훅 처리
        'database',      // 데이터베이스 관련
        'auth',          // 인증/인가
        'config',        // 설정 관련
        'deps',          // 의존성 관리
        'docker',        // Docker 관련
        'infra',         // 인프라/배포 관련
        'ci',            // CI/CD
        'docs',          // 문서
      ],
    ],
    'scope-case': [2, 'always', 'kebab-case'],
    'subject-case': [2, 'always', 'sentence-case'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};
