# radustoian.com auth.md

Authentication and authorization discovery metadata for autonomous AI agents, crawlers, and API clients interacting with `radustoian.com`.

---

## 1. Overview & Agent Audience

The APIs and agentic interfaces hosted on `radustoian.com`—including the Model Context Protocol endpoint (`/mcp`), the Public REST API (`/api`), and associated discovery catalogs—are open and public by default.

This document describes authentication discovery per the [Auth.md Specification](https://isitagentready.com/.well-known/agent-skills/auth-md/SKILL.md), [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414), [OpenID Connect Discovery 1.0](http://openid.net/specs/openid-connect-discovery-1_0.html), and [RFC 9728 (OAuth Protected Resource Metadata)](https://www.rfc-editor.org/rfc/rfc9728).

- **Primary Resource Identifier:** `https://radustoian.com`
- **Primary Authorization Server (Issuer):** `https://radustoian.com`
- **Default Access Model:** Open / Anonymous public access (no credentials required for standard queries).
- **Bearer Transmission:** `Authorization: Bearer <token>` HTTP header.

---

## 2. Discovery Endpoints

Autonomous agents can programmatically discover security configuration and endpoints at the following locations:

| Discovery Document | Standard | URL |
| :--- | :--- | :--- |
| **OAuth 2.0 Authorization Server** | RFC 8414 | `https://radustoian.com/.well-known/oauth-authorization-server` |
| **OpenID Connect Configuration** | OIDC Discovery 1.0 | `https://radustoian.com/.well-known/openid-configuration` |
| **OAuth Protected Resource Metadata** | RFC 9728 | `https://radustoian.com/.well-known/oauth-protected-resource` |
| **JSON Web Key Set (JWKS)** | RFC 7517 | `https://radustoian.com/.well-known/jwks.json` |

---

## 3. Supported Authentication Flows

### A. Anonymous Access (Default)
Agents and scrapers may query all profile information, BM25 endpoints, and MCP tools anonymously. No token or registration is mandated.
- **Identity Type:** `anonymous`
- **Credential Type:** Optional Bearer token or omitted
- **Claim URI:** `https://radustoian.com/oauth/token`

### B. Machine-to-Machine Client Credentials
Autonomous agents seeking identifiable telemetric reporting, higher throughput limits, or formal agent sessions can request tokens via OAuth 2.0 Client Credentials.
- **Grant Type:** `client_credentials`
- **Token Endpoint:** `https://radustoian.com/oauth/token`
- **Authentication Method:** `client_secret_basic`, `client_secret_post`

### C. Identity Assertion (ID-JAG & Verified Email)
Federated agent identities can assert verified credentials per RFC token exchange mechanisms.
- **Identity Types:** `identity_assertion`
- **Assertion Types:** `urn:ietf:params:oauth:token-type:id-jag`, `verified_email`
- **Token Endpoint:** `https://radustoian.com/oauth/token`

---

## 4. Scopes & Permissions

| Scope | Description |
| :--- | :--- |
| `read:profile` | Read public profile information, biography, credentials, and case studies. |
| `read:ai` | Execute dynamic BM25 queries, retrieve citations, and interact with WebMCP / MCP tools. |
| `openid` | OpenID Connect user and machine identity verification. |
| `profile` | Basic profile claims (`name`, `preferred_username`). |
| `email` | Identity verification email claim. |

---

## 5. Endpoints Reference

- **Issuer:** `https://radustoian.com`
- **Authorization Endpoint:** `https://radustoian.com/oauth/authorize`
- **Token Endpoint:** `https://radustoian.com/oauth/token`
- **Registration Endpoint:** `https://radustoian.com/oauth/register`
- **JWKS URI:** `https://radustoian.com/.well-known/jwks.json`
- **Documentation:** `https://radustoian.com/auth.md`
