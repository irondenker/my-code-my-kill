/**
 * HTTP 상태 코드를 함께 전달하기 위한 애플리케이션 에러 클래스입니다.
 *
 * 용도:
 * - 컨트롤러/미들웨어에서 `throw`하여 상태 코드와 메시지를 한 번에 전달합니다.
 * - 전역 에러 핸들러가 `status`를 읽어 적절한 응답을 생성합니다.
 */
export class HttpError extends Error {
  status: number;

  /**
   * @param status HTTP 상태 코드(예: 400, 401, 403, 404, 500)
   * @param message 사용자/로그에 전달할 에러 메시지
   */
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
