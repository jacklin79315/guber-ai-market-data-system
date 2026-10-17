import test from "node:test";
import assert from "node:assert/strict";
import {validateNewAccount} from "./account-policy.mjs";
test("reject weak viewer credentials",()=>{assert.equal(validateNewAccount({username:"user001",password:"1234"}).valid,false);assert.equal(validateNewAccount({username:"user001",password:"passwordpassword"}).valid,false)});
test("accept strong independent credentials",()=>{assert.equal(validateNewAccount({username:"user001",password:"GreenCedar2026Safe"}).valid,true)});
test("reject invalid usernames and password containing username",()=>{assert.equal(validateNewAccount({username:"01",password:"GreenCedar2026Safe"}).valid,false);assert.equal(validateNewAccount({username:"user001",password:"user001Secure2026"}).valid,false)});
