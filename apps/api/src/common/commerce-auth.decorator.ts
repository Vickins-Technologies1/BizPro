import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";

export const COMMERCE_SCOPES_KEY = "commerce_scopes";
export const CommerceScopes = (...scopes: string[]) => SetMetadata(COMMERCE_SCOPES_KEY, scopes);

export type CommercePrincipal = {
  credentialId: string;
  businessId: string;
  scopes: string[];
  branchIds: string[];
  rateLimitPerMinute: number;
};

export const CommerceAuth = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ commerceAuth?: CommercePrincipal }>();
  return request.commerceAuth;
});
