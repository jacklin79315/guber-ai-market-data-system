import test from "node:test";
import assert from "node:assert/strict";
import {ROLES,PERMISSIONS,can,publicIdentity} from "./access-policy.mjs";
test("viewer has read-only access",()=>{for(const action of Object.keys(PERMISSIONS)){assert.equal(can(ROLES.VIEWER,action),action.endsWith(":read"),action)}});
test("admin has all declared permissions",()=>{for(const action of Object.keys(PERMISSIONS))assert.equal(can(ROLES.ADMIN,action),true)});
test("unknown identities and actions fail closed",()=>{for(const role of [null,"","user","administrator",undefined])assert.equal(can(role,"market:read"),false);assert.equal(can("admin","trading:execute"),false);assert.equal(can("viewer","users:manage"),false);assert.equal(publicIdentity(null,"admin"),null);assert.equal(publicIdentity({id:"x"},"unknown"),null)});
test("identity exposes only approved permission list",()=>{const viewer=publicIdentity({id:"abc",email:"private@example.invalid"},ROLES.VIEWER);assert.equal(viewer.role,"viewer");assert.equal(viewer.permissions.includes("users:manage"),false);assert.equal(Object.hasOwn(viewer,"email"),false)});
