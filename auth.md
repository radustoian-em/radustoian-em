# radustoian.com auth.md

Authentication and authorization discovery metadata for autonomous AI agents, crawlers, and API clients interacting with radustoian.com.

---

## 1. Overview & Agent Audience

The APIs and agentic interfaces hosted on radustoian.com—including the Model Context Protocol endpoint (/mcp), the Public REST API (/api), and associated discovery catalogs—are open and public by default.

This document describes authentication discovery per the Auth.md Specification, RFC 8414, OpenID Connect Discovery 1.0, and RFC 9728 (OAuth Protected Resource Metadata).

- Primary Resource Identifier: https://radustoian.com
- Primary Authorization Server (Issuer): https://radustoian.com
- Default Access Model: Open / Anonymous public access (no credentials required for standard queries).
- Bearer Transmission: Authorization: Bearer <token> in HTTP headers.

---

## 2. Discovery Endpoints

Autonomous agents can programmatically discover security configuration and endpoints at the following locations:

- OAuth 2.0 Authorization Server: https://radustoian.com/.well-known/oauth-authorization-server
- OpenID Connect Configuration: https://radustoian.com/.well-known/openid-configuration
- OAuth Protected Resource Metadata: https://radustoian.com/.well-known/oauth-protected-resource
- JSON Web Key Set (JWKS): https://radustoian.com/.well-known/jwks.json

---

## 3. Agent Authentication Flows & Registration

### Flow A: Anonymous Access (Default)
Agents and scrapers may query all profile information, BM25 endpoints, and MCP tools anonymously. No token or registration is mandated.
- identity_types_supported: ["anonymous"]
- anonymous:
  - credential_types_supported: ["bearer_token"]
  - claim_uri: https://radustoian.com/oauth/token

### Flow B: Machine-to-Machine Client Credentials
Autonomous agents seeking identifiable sessions, higher throughput limits, or telemetric tracking can register dynamically and exchange credentials:
- Registration URI: https://radustoian.com/oauth/register
- Token URI: https://radustoian.com/oauth/token
- Claim URI: https://radustoian.com/oauth/token
- Grant Type: client_credentials
- Methods Supported: ["client_credentials", "anonymous", "identity_assertion"]

### Flow C: Identity Assertion (ID-JAG & Verified Email)
Federated agent identities can assert verified credentials per RFC token exchange mechanisms.
- identity_types_supported: ["identity_assertion"]
- identity_assertion:
  - assertion_types_supported: ["urn:ietf:params:oauth:token-type:id-jag", "verified_email"]
  - credential_types_supported: ["bearer_token"]
  - claim_uri: https://radustoian.com/oauth/token

### Standalone Flow Definition
```json
{
  "skill": "https://radustoian.com/auth.md",
  "register_uri": "https://radustoian.com/oauth/register",
  "claim_uri": "https://radustoian.com/oauth/token",
  "identity_types_supported": ["anonymous", "identity_assertion"],
  "credential_types_supported": ["bearer_token"],
  "anonymous": {
    "credential_types_supported": ["bearer_token"],
    "claim_uri": "https://radustoian.com/oauth/token"
  },
  "identity_assertion": {
    "assertion_types_supported": ["urn:ietf:params:oauth:token-type:id-jag", "verified_email"],
    "credential_types_supported": ["bearer_token"],
    "claim_uri": "https://radustoian.com/oauth/token"
  }
}
```

---

## 4. Scopes & Permissions

- `read:profile`: Read public profile information, biography, credentials, and case studies.
- `read:ai`: Execute dynamic BM25 queries, retrieve citations, and interact with WebMCP / MCP tools.
- `openid`: OpenID Connect user and machine identity verification.
- `profile`: Basic profile claims (name, preferred_username).
- `email`: Identity verification email claim.

---

## 5. Endpoints Reference

- Issuer: https://radustoian.com
- Authorization Endpoint: https://radustoian.com/oauth/authorize
- Token Endpoint: https://radustoian.com/oauth/token
- Registration Endpoint: https://radustoian.com/oauth/register
- Claim Endpoint: https://radustoian.com/oauth/token
- Revocation Endpoint: https://radustoian.com/oauth/revoke
- JWKS URI: https://radustoian.com/.well-known/jwks.json
- Documentation: https://radustoian.com/auth.md
