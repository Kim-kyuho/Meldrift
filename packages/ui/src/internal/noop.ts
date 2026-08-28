/** 기본 콜백. 렌더마다 새 함수가 생기면 useCallback 의존성이 깨지므로 모듈 스코프에 하나만 둔다. */
export const noop = () => {};
