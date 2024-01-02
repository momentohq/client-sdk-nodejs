import {Status} from '@grpc/grpc-js/build/src/constants';
import {ServiceError} from '@grpc/grpc-js';
import {
  NotFoundError,
  InternalServerError,
  InvalidArgumentError,
  PermissionError,
  BadRequestError,
  CancelledError,
  TimeoutError,
  AuthenticationError,
  LimitExceededError,
  AlreadyExistsError,
  SdkError,
  UnknownServiceError,
  ServerUnavailableError,
  UnknownError,
  FailedPreconditionError,
} from '../../src';

export class CacheServiceErrorMapper {
  private readonly throwOnError: boolean;

  constructor(throwOnError: boolean) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    console.log(`CONSTRUCTING CACHE SERVICE ERROR MAPPER: ${throwOnError}`);
    this.throwOnError = throwOnError;
  }
  handleError(
    err: ServiceError | null,
    errorResponseFactoryFn: (err: SdkError) => unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolveFn: (result: any) => void,
    rejectFn: (err: SdkError) => void
  ): void {
    const error = this.convertError(err);

    if (this.throwOnError) {
      rejectFn(error);
    } else {
      resolveFn(errorResponseFactoryFn(error));
    }
  }

  convertError(err: ServiceError | null): SdkError {
    const errParams: [
      string,
      number | undefined,
      object | undefined,
      string | undefined
    ] = [
      err?.message || 'Unable to process request',
      err?.code,
      err?.metadata,
      err?.stack,
    ];
    switch (err?.code) {
      case Status.PERMISSION_DENIED:
        return new PermissionError(...errParams);
      case Status.DATA_LOSS:
      case Status.INTERNAL:
      case Status.ABORTED:
        return new InternalServerError(...errParams);
      case Status.UNKNOWN:
        return new UnknownServiceError(...errParams);
      case Status.UNAVAILABLE:
        return new ServerUnavailableError(...errParams);
      case Status.NOT_FOUND:
        return new NotFoundError(...errParams);
      case Status.OUT_OF_RANGE:
      case Status.UNIMPLEMENTED:
        return new BadRequestError(...errParams);
      case Status.FAILED_PRECONDITION:
        return new FailedPreconditionError(...errParams);
      case Status.INVALID_ARGUMENT:
        return new InvalidArgumentError(...errParams);
      case Status.CANCELLED:
        return new CancelledError(...errParams);
      case Status.DEADLINE_EXCEEDED:
        return new TimeoutError(...errParams);
      case Status.UNAUTHENTICATED:
        return new AuthenticationError(...errParams);
      case Status.RESOURCE_EXHAUSTED:
        return new LimitExceededError(...errParams);
      case Status.ALREADY_EXISTS:
        return new AlreadyExistsError(...errParams);
      default:
        return new UnknownError(...errParams);
    }
  }
}
