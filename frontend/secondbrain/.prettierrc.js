/**
 * Prettier Configuration
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  // 기본 포맷팅 설정
  semi: true, // 세미콜론 사용
  singleQuote: true, // 싱글 쿼트 사용
  trailingComma: 'all', // 가능한 모든 곳에 trailing comma 추가
  tabWidth: 2, // 탭 너비 2칸
  printWidth: 100, // 한 줄 최대 길이 100자
  useTabs: false, // 스페이스 사용 (탭 사용 안 함)

  // React/JSX 설정
  jsxSingleQuote: false, // JSX에서는 더블 쿼트 사용
  bracketSpacing: true, // 객체 리터럴 괄호 안에 공백 추가
  bracketSameLine: false, // JSX 닫는 괄호를 다음 줄에 위치
  arrowParens: 'always', // 화살표 함수 매개변수에 항상 괄호 사용

  // 플러그인 설정
  plugins: ['prettier-plugin-tailwindcss'], // TailwindCSS 클래스 자동 정렬
  tailwindStylesheet: './src/index.css',
};

export default config;
