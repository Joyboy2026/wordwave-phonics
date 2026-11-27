export class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message, code = "bad_request") {
  return new AppError(400, code, message);
}

export function unauthorized(message = "请先登录", code = "unauthorized") {
  return new AppError(401, code, message);
}

export function forbidden(message = "没有权限", code = "forbidden") {
  return new AppError(403, code, message);
}

export function notFound(message = "资源不存在", code = "not_found") {
  return new AppError(404, code, message);
}

export function conflict(message, code = "conflict") {
  return new AppError(409, code, message);
}
