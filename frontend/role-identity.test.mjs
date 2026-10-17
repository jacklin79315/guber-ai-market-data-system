import test from "node:test";
import assert from "node:assert/strict";
import {parseViewers,identifyUsername,identifyUser} from "./role-identity.mjs";
const viewers=parseViewers(JSON.stringify([{username:"reader01",userId:"viewer-uid",email:"reader@internal.invalid"}]));
test("explicit viewer username maps to matching identity",()=>{assert.equal(viewers.length,1);assert.equal(identifyUsername("reader01","guber","admin@internal.invalid","admin-uid",viewers).role,"viewer");assert.equal(identifyUser({id:"viewer-uid",email:"reader@internal.invalid"},"admin@internal.invalid","admin-uid",viewers).role,"viewer")});
test("viewer access denies unknown users and identity mismatch",()=>{assert.equal(identifyUsername("stranger","guber","admin@internal.invalid","admin-uid",viewers),null);assert.equal(identifyUser({id:"viewer-uid",email:"other@internal.invalid"},"admin@internal.invalid","admin-uid",viewers),null);assert.equal(identifyUser({id:"other",email:"reader@internal.invalid"},"admin@internal.invalid","admin-uid",viewers),null)});
test("reject duplicate and malformed viewer configuration",()=>{assert.deepEqual(parseViewers("invalid"),[]);assert.deepEqual(parseViewers(JSON.stringify([{username:"x",userId:"1",email:"x@x"}])),[]);assert.deepEqual(parseViewers(JSON.stringify([{username:"reader01",userId:"1",email:"a@x"},{username:"reader01",userId:"2",email:"b@x"}])),[])});
