import assert from "node:assert/strict"
import test from "node:test"
import { after } from "node:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

async function loadModule({ sourcePath, outputName, replacements = [] }) {
  let source = await readFile(sourcePath, "utf8")

  for (const [searchValue, replaceValue] of replacements) {
    source = source.replace(searchValue, replaceValue)
  }

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auth-integrity-"))
  const modulePath = path.join(tempDir, outputName)
  await writeFile(modulePath, transpiled, "utf8")

  const loaded = await import(pathToFileURL(modulePath).href)
  return {
    ...loaded,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  }
}

const envModule = await loadModule({
  sourcePath: path.resolve("lib/supabase/env.ts"),
  outputName: "env.mjs",
})

const proxyModule = await loadModule({
  sourcePath: path.resolve("proxy.ts"),
  outputName: "proxy.mjs",
  replacements: [
    ['import { createServerClient } from "@supabase/ssr"', "const createServerClient = () => ({ auth: { getUser: async () => ({ data: { user: null } }) } })"],
    ['import { NextResponse, type NextRequest } from "next/server"', 'const NextResponse = { next: (input = {}) => ({ type: "next", ...input, cookies: { set() {} } }), redirect: (url) => ({ type: "redirect", url }), json: (body, init) => ({ type: "json", body, ...init }) }'],
    ['import {\n  evaluateSupabaseEnv,\n  type SupabasePublicEnv,\n} from "@/lib/supabase/env"\n', "const evaluateSupabaseEnv = () => ({ public: null, publicError: null })\n"],
  ],
})

const apiAuthModule = await loadModule({
  sourcePath: path.resolve("lib/api-auth.ts"),
  outputName: "api-auth.mjs",
  replacements: [
    ['import type { Client, OrganizationMember, OrganizationMemberRole } from "./types"\n\n', ""],
    ['import { extractClientIdFromRouteSegment, isUuid, matchesClientRouteSegment } from "./routing/clients"\n', 'const extractClientIdFromRouteSegment = (value) => value\nconst isUuid = () => true\nconst matchesClientRouteSegment = () => false\n'],
    ['import { supabaseAdmin } from "./supabase/admin"\n', "const supabaseAdmin = {}\n"],
  ],
})

const {
  evaluateSupabaseEnv,
  getSupabaseConfigError,
  requireSupabaseServerEnv,
} = envModule
const { getProxyDecision } = proxyModule
const { getClientAuthorizationState } = apiAuthModule

test("public auth route is allowed even when config is missing", () => {
  const decision = getProxyDecision({
    pathname: "/login",
    hasValidPublicAuthConfig: false,
    isAuthenticated: false,
  })

  assert.equal(decision.action, "allow")
})

test("protected route with valid config follows normal auth path", () => {
  const unauthenticatedDecision = getProxyDecision({
    pathname: "/clients/demo",
    hasValidPublicAuthConfig: true,
    isAuthenticated: false,
  })
  const authenticatedDecision = getProxyDecision({
    pathname: "/clients/demo",
    hasValidPublicAuthConfig: true,
    isAuthenticated: true,
  })

  assert.equal(unauthenticatedDecision.action, "redirect_login")
  assert.equal(authenticatedDecision.action, "allow")
})

test("protected route with missing config fails closed", () => {
  const decision = getProxyDecision({
    pathname: "/clients/demo",
    hasValidPublicAuthConfig: false,
    isAuthenticated: false,
  })

  assert.equal(decision.action, "fail_closed")
})

test("no redirect loop on login route", () => {
  const decision = getProxyDecision({
    pathname: "/login",
    hasValidPublicAuthConfig: true,
    isAuthenticated: false,
  })

  assert.equal(decision.action, "allow")
})

test("authenticated user can access reset-password route during recovery", () => {
  const decision = getProxyDecision({
    pathname: "/reset-password",
    hasValidPublicAuthConfig: true,
    isAuthenticated: true,
  })

  assert.equal(decision.action, "allow")
})

test("account route is treated as protected", () => {
  const decision = getProxyDecision({
    pathname: "/account",
    hasValidPublicAuthConfig: true,
    isAuthenticated: false,
  })

  assert.equal(decision.action, "redirect_login")
})

test("unauthenticated client-scoped API resolves to 401", () => {
  const result = getClientAuthorizationState({
    user: null,
    membershipOrgId: null,
    client: null,
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 401)
})

test("authenticated non-member resolves to safe 404", () => {
  const result = getClientAuthorizationState({
    user: { id: "user-1" },
    membershipOrgId: null,
    client: null,
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 404)
  assert.equal(result.error, "Client not found.")
})

test("cross-tenant clientId access is rejected without leakage", () => {
  const result = getClientAuthorizationState({
    user: { id: "user-1" },
    membershipOrgId: "org-1",
    client: null,
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 404)
})

test("service-role key is never exposed by the public env helper", () => {
  const result = evaluateSupabaseEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  })

  assert.deepEqual(result.public, {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
  })
  assert.equal(Object.prototype.hasOwnProperty.call(result.public, "supabaseServiceRoleKey"), false)
})

test("production mock fallback is disabled", () => {
  assert.throws(
    () =>
      requireSupabaseServerEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    /SUPABASE_SERVICE_ROLE_KEY/
  )
})

test("development configuration error is clear and non-secret", () => {
  const message = getSupabaseConfigError({
    NODE_ENV: "development",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  })

  assert.match(message ?? "", /Supabase authentication is not configured/i)
  assert.doesNotMatch(message ?? "", /service-role-secret|sk_/i)
})

after(async () => {
  await Promise.all([envModule.cleanup(), proxyModule.cleanup(), apiAuthModule.cleanup()])
})
