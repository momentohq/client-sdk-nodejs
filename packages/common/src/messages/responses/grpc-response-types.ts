/**
 * This file exists as a layer between our javascript classes and the grpc generated
 * ones. Its required since the types generated by grpc-web are different than those
 * generated by grpc for node. Inside of the respective clients, we will map the grpc
 * response types to these corresponding types. This allows us to share the response
 * messages between the 2 sdks.
 */

export enum _ECacheResult {
  Invalid = 0,
  Ok = 1,
  Hit = 2,
  Miss = 3,
}

export class _DictionaryFieldValuePair {
  readonly field: Uint8Array;
  readonly value: Uint8Array;
  constructor({field, value}: {field: Uint8Array; value: Uint8Array}) {
    this.field = field;
    this.value = value;
  }
}

export class _DictionaryGetResponsePart {
  readonly result: _ECacheResult;
  readonly cacheBody: Uint8Array;

  constructor(result: _ECacheResult, cacheBody: Uint8Array) {
    this.result = result;
    this.cacheBody = cacheBody;
  }
}

export class _SortedSetGetScoreResponsePart {
  readonly result: _ECacheResult;
  readonly score: number;
  constructor(result: _ECacheResult, score: number) {
    this.result = result;
    this.score = score;
  }
}

export class _Cache {
  readonly cacheName: string;
  constructor(cacheName: string) {
    this.cacheName = cacheName;
  }
}

export class _ListCachesResponse {
  readonly caches: _Cache[];
  readonly nextToken: string;
  constructor(caches?: _Cache[], nextToken?: string) {
    this.caches = caches ?? [];
    this.nextToken = nextToken ?? '';
  }
}

export class _GenerateApiTokenResponse {
  readonly apiToken: string;
  readonly refreshToken: string;
  readonly endpoint: string;
  readonly validUntil: number;
  constructor(
    apiToken?: string,
    refreshToken?: string,
    endpoint?: string,
    validUntil?: number
  ) {
    this.apiToken = apiToken ?? '';
    this.refreshToken = refreshToken ?? '';
    this.endpoint = endpoint ?? '';
    this.validUntil = validUntil ?? 0;
  }
}

export class _SigningKey {
  readonly key: string;
  readonly expiresAt: number;
  constructor(key?: string, expiresAt?: number) {
    this.key = key ?? '';
    this.expiresAt = expiresAt ?? 0;
  }
}

export class _SortedSetElement {
  readonly value: Uint8Array;
  readonly score: number;

  constructor(value: Uint8Array, score: number) {
    this.value = value;
    this.score = score;
  }
}

export class _ListSigningKeysResponse {
  readonly signingKeys: _SigningKey[];
  readonly nextToken: string;

  constructor(signingKeys?: _SigningKey[], nextToken?: string) {
    this.signingKeys = signingKeys ?? [];
    this.nextToken = nextToken ?? '';
  }
}
