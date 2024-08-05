interface BaseErrorParams<T extends string> {
  name: T;
  id: number;
  message: string;
  httpStatusCode: number;
}

abstract class BaseError<T extends string> extends Error {
  public name: T;

  public id: number;

  public message: string;

  public httpStatusCode: number;

  constructor({ name, id, message, httpStatusCode }: BaseErrorParams<T>) {
    super(message || name || "Error");
    this.name = name;
    this.id = id;
    this.message = message;
    this.httpStatusCode = httpStatusCode;
  }
}

export class UnauthorizedError extends BaseError<"UnauthorizedError"> {
  constructor({ message }: { message: string }) {
    super({ name: "UnauthorizedError", id: 100, message, httpStatusCode: 401 });
  }
}

export class UnauthenticatedError extends BaseError<"UnauthenticatedError"> {
  constructor({ message }: { message: string }) {
    super({
      name: "UnauthenticatedError",
      id: 101,
      message,
      httpStatusCode: 403,
    });
  }
}
