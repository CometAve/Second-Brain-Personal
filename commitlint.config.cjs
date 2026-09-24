const path = require('node:path');

const scopes = [
  'frontend',
  'extension',
  'backend',
  'knowledge-graph-service',
  'agent-MCP',
  'infra',
];

module.exports = {
  extends: [
    require.resolve('@commitlint/config-conventional', {
      paths: [path.join(__dirname, 'frontend/secondbrain'), path.join(__dirname, 'extension')],
    }),
  ],
  plugins: [
    {
      rules: {
        'scope-module': ({ scope }) => [
          !scope || scopes.includes(scope),
          `scope는 생략하거나 다음 모듈 중 하나를 사용합니다: ${scopes.join(', ')}`,
        ],
        'subject-korean': ({ subject }) => [
          !subject || /[가-힣]/u.test(subject),
          '제목의 설명은 한국어로 작성합니다. 기술 식별자는 원래 표기를 사용할 수 있습니다.',
        ],
      },
    },
  ],
  rules: {
    'scope-module': [2, 'always'],
    'scope-empty': [0],
    'scope-case': [0],
    'subject-korean': [2, 'always'],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
