import test from "node:test";
import assert from "node:assert/strict";
import { createExportHandler } from "./routes.js";
import { OperationsError } from "../errors.js";

const eventId="22222222-2222-4222-8222-222222222222";
const principal={kind:"staff",id:"55555555-5555-4555-8555-555555555555"};
const params=Promise.resolve({eventId});
const request=kind=>new Request(`https://example.test/api/events/${eventId}/operations/export?kind=${kind}`);
const empty={revision:0,enabled:true,people:[],resources:[],activities:[],assignments:[],cycles:[],evaluations:[],attendance:[],releases:[],acknowledgements:[],tasks:[],outbox:[],invitations:[],identityLinks:[]};

test("private exports authorize manager history access before reading records",async()=>{
  let reads=0;
  const GET=createExportHandler({resolvePrincipal:async()=>principal,authorize:async(_p,id,key)=>{
    assert.equal(id,eventId);assert.equal(key,"events.operations.record_archive");throw new OperationsError("forbidden",403,"Access denied.");
  },store:{snapshot:async()=>{reads++;return empty;}}});
  const response=await GET(request("evaluations"),{params});
  assert.equal(response.status,403);assert.equal(reads,0);
});

test("CSV downloads read immutable history, reject partial exports and carry private headers",async()=>{
  let historyReads=0;
  const context={projectId:"11111111-1111-4111-8111-111111111111",eventId,principal,permission:"events.operations.record_archive"};
  const store={snapshot:async()=>empty,history:async()=>{historyReads++;return {attendanceRevisions:[],evaluationRevisions:[],truncated:false};}};
  const GET=createExportHandler({resolvePrincipal:async()=>principal,authorize:async()=>context,store});
  const response=await GET(request("attendance"),{params});
  assert.equal(response.status,200);assert.equal(historyReads,1);
  assert.equal(response.headers.get("Cache-Control"),"private, no-store");assert.equal(response.headers.get("X-Content-Type-Options"),"nosniff");
  assert.ok(response.headers.get("Content-Disposition").includes("operations-attendance.csv"));
  store.history=async()=>({attendanceRevisions:[],evaluationRevisions:[],truncated:true});
  assert.equal((await GET(request("attendance"),{params})).status,409);
  assert.equal((await GET(request("people&kind=evaluations"),{params})).status,400);
});
