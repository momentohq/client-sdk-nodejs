import {
  AuthClient,
  CredentialProvider,
  GenerateDisposableToken,
} from "@gomomento/sdk";
import {
  tokenPermissions,
  tokenExpiresIn,
  authenticationMethod,
  AuthenticationMethod,
} from "./config";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getServerSession } from "next-auth";

const authClient = new AuthClient({
  credentialProvider: CredentialProvider.fromString({
    apiKey: process.env.MOMENTO_API_KEY,
  }),
});

export const revalidate = 0;
export async function GET(_request: Request) {
  let generateApiKeyResponse;
  switch (authenticationMethod) {
    case AuthenticationMethod.Open:
      generateApiKeyResponse = await fetchTokenWithOpenAuth();
      break;
    case AuthenticationMethod.Credentials:
      generateApiKeyResponse = await fetchTokenWithAuthCredentials();
      break;
    default:
      throw new Error("Unimplemented authentication method");
  }

  if (generateApiKeyResponse instanceof GenerateDisposableToken.Success) {
    return new Response(generateApiKeyResponse.apiKey, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  } else if (
    generateApiKeyResponse instanceof GenerateDisposableToken.Error
  ) {
    throw new Error(generateApiKeyResponse.message());
  }
  throw new Error("Unable to get token from momento");
}

async function fetchTokenWithOpenAuth() {
  return await authClient.generateDisposableToken(
    tokenPermissions,
    tokenExpiresIn,
  );
}

async function fetchTokenWithAuthCredentials() {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Unauthorized to request Momento token");
  }

  return await authClient.generateDisposableToken(
    tokenPermissions,
    tokenExpiresIn,
  );
}
