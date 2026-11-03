import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openOutreach, seal, unseal, outreachPath } from '../src/admin/server/outreach-store.mjs';
import { createGmail, oauthStart, consumeOAuth, oauthFinish, mimeMessage, isBounce, GmailConnectionError, gmailConnectionCode } from '../src/admin/server/outreach-gmail.mjs';
import { gmailConnectionMessage, markdownHtml, splitPastedEmail, validateDraft } from '../src/shared/outreach.mjs';

const env={NODE_ENV:'test',OUTREACH_ENCRYPTION_KEY:'aa'.repeat(32),GMAIL_CLIENT_ID:'test',GMAIL_CLIENT_SECRET:'secret',GMAIL_REDIRECT_URI:'http://127.0.0.1:3001/api/outreach/oauth/callback'};
async function fixture(t) {
  const dir=await mkdtemp(join(tmpdir(),'outreach-')),path=join(dir,'outreach.sqlite'),store=openOutreach(path,env);
  t.after(async()=>{store.close();await rm(dir,{recursive:true,force:true});});
  store.run('INSERT INTO accounts(id,email,can_send,credentials,created_at) VALUES(?,?,?,?,?)','sender','owner@gmail.com',1,seal({access_token:'access-secret',refresh_token:'refresh-secret',expires_at:Date.now()+3600000},env),store.now());
  return {store,path};
}
const record={account_id:'sender',recipient:'office@example.com',subject:'A website for your company',body:'Hello **there**.\n\n[Website](https://example.com)',company:'Example',website:'https://example.com',instagram:''};
test('Markdown paste extracts a real Subject, renders safely, and MIME keeps it out of the body',()=>{
  const pasted=splitPastedEmail('**Website idea**\n\nHello **Sam**');
  assert.deepEqual(pasted,{subject:'Website idea',body:'Hello **Sam**'});
  assert.equal(splitPastedEmail('Hello **Sam**'),null);
  assert.throws(()=>validateDraft({...record,subject:'hello\r\nBcc: bad@example.com'},true));
  const html=markdownHtml('<script>alert(1)</script> **bold** [bad](javascript:alert(1))\n\n- one\n- two');
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('<strong>bold</strong>'));assert.ok(html.includes('<ul>'));
  const mime=Buffer.from(mimeMessage({...record,sender:'owner@gmail.com',rfc_id:'<unique@gmail.com>',attempt_at:new Date().toISOString()}),'base64url').toString();
  assert.match(mime,/Subject: =\?UTF-8\?B\?/);assert.match(mime,/multipart\/alternative/);assert.match(mime,/Message-ID: <unique@gmail.com>/);
});
test('pasted Email then Caption parameters stay separate from the Markdown message',()=>{
  const parameters=splitPastedEmail('**Office@Example.com**\r\n\r\n**Website idea**\r\n\r\nHello **Sam**');
  assert.deepEqual(parameters,{recipient:'office@example.com',subject:'Website idea',body:'Hello **Sam**'});
  assert.equal(splitPastedEmail('**office@example.com**\nHello'),null);
  assert.equal(splitPastedEmail('**office@invalid**\n**Caption**\nMessage'),null);
  const values=validateDraft({...record,...parameters},true);
  const mime=Buffer.from(mimeMessage({...values,sender:'owner@gmail.com',rfc_id:'<parameters@gmail.com>',attempt_at:new Date().toISOString()}),'base64url').toString();
  assert.match(mime,/To: office@example.com\r\n/);
  assert.ok(mime.includes(`Subject: =?UTF-8?B?${Buffer.from('Website idea').toString('base64')}?=`));
  const plain=mime.split('Content-Type: text/plain; charset=UTF-8')[1].split('--alt_')[0].split('\r\n\r\n')[1];
  const body=Buffer.from(plain.replace(/\s/g,''),'base64').toString();
  assert.equal(body,'Hello **Sam**');assert.ok(!body.includes('office@example.com'));assert.ok(!body.includes('Website idea'));
});
test('credentials are authenticated encryption, snapshots redact them, production storage fails closed',async t=>{
  const {store,path}=await fixture(t),sealed=seal({secret:'private'},env);
  assert.equal(unseal(sealed,env).secret,'private');assert.throws(()=>unseal(sealed,{...env,OUTREACH_ENCRYPTION_KEY:'bb'.repeat(32)}));
  assert.ok(!JSON.stringify(store.snapshot()).includes('access-secret'));assert.ok(!JSON.stringify(store.snapshot()).includes('credentials'));
  assert.ok(!(await readFile(path)).includes(Buffer.from('refresh-secret')));
  assert.throws(()=>outreachPath({NODE_ENV:'production'}));assert.throws(()=>outreachPath({VERCEL:'1',OUTREACH_DATA_PATH:'/persistent/file'}));
});
test('drafts can be saved and reopened before a Gmail account is connected',async t=>{
  const {store}=await fixture(t),draft=store.saveDraft({record:{subject:'Start here',body:'Body'}},'owner');
  assert.equal(draft.account_id,null);
  const edited=store.saveDraft({id:draft.id,version:draft.version,record:{...draft,body:'Updated'}},'owner');
  assert.equal(edited.body,'Updated');assert.equal(edited.version,2);
});
test('draft versions, content dedupe, suppression and per-account daily reservations are enforced atomically',async t=>{
  const {store}=await fixture(t),a=store.saveDraft({record},'owner');
  const b=store.saveDraft({record},'owner');
  assert.throws(()=>store.saveDraft({id:a.id,version:0,record},'owner'),/changed/);
  store.run('UPDATE accounts SET daily_limit=1 WHERE id=?','sender');
  store.reserveSend({id:a.id,version:a.version},'owner');
  assert.equal(store.snapshot().accounts[0].remaining,0);
  assert.throws(()=>store.reserveSend({id:a.id,version:a.version},'owner'),/already submitted/);
  assert.throws(()=>store.reserveSend({id:b.id,version:b.version},'owner'),/limit/);
  store.run('UPDATE accounts SET daily_limit=10 WHERE id=?','sender');
  assert.throws(()=>store.reserveSend({id:b.id,version:b.version},'owner'),/identical/);
  store.suppress({kind:'domain',value:'example.com',reason:'Declined'},'owner');
  const c=store.saveDraft({record:{...record,body:'A different message'}},'owner');
  assert.throws(()=>store.reserveSend({id:c.id,version:c.version},'owner'),/suppression/);
  store.saveLead({name:'Example',website:'https://www.example.com',location_id:'city'},'owner');
  assert.throws(()=>store.saveLead({name:'Other',website:'https://example.com/about',location_id:'city'},'owner'),/already saved/);
});
test('OAuth state is one-use, actor/browser bound and reconnect rejects a different Gmail identity',async t=>{
  const {store}=await fixture(t),start=oauthStart(store,'owner',{id:'sender'},env),url=new URL(start.url);
  assert.ok(url.searchParams.get('code_challenge'));assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.throws(()=>consumeOAuth(store,'other',url.searchParams.get('state'),start.binding,env));
  assert.throws(()=>consumeOAuth(store,'owner',url.searchParams.get('state'),'bad',env));
  const pending=consumeOAuth(store,'owner',url.searchParams.get('state'),start.binding,env);
  assert.throws(()=>consumeOAuth(store,'owner',url.searchParams.get('state'),start.binding,env));
  const fetcher=async url=>Response.json(url.includes('/token')?{access_token:'new',refresh_token:'refresh',scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'}:{emailAddress:'other@gmail.com'});
  await assert.rejects(oauthFinish(store,'owner',pending,'code',{env,fetcher}),/different Gmail/);
  assert.equal(store.account('sender').email,'owner@gmail.com');
});
test('send timeout is uncertain, consumes allowance and never repeats the Gmail send call',async t=>{
  const {store}=await fixture(t),draft=store.saveDraft({record},'owner');let sends=0;
  const gmail=createGmail(store,{env,fetcher:async()=>{sends++;throw new Error('timeout');}});
  await assert.rejects(gmail.send({id:draft.id,version:draft.version},'owner'),/uncertain/);
  assert.equal(store.message(draft.id).state,'uncertain');assert.equal(store.snapshot().accounts[0].remaining,9);
  await assert.rejects(gmail.send({id:draft.id,version:draft.version},'owner'),/already submitted/);assert.equal(sends,1);
});
test('sender Sent is never inbox proof; authorized receiver SPAM is proof and pauses sending',async t=>{
  const {store}=await fixture(t),draft=store.saveDraft({record},'owner');
  const gmail=createGmail(store,{env,fetcher:async url=>{
    if(url.endsWith('/messages/send'))return Response.json({id:'gmail-message',threadId:''});
    if(url.includes('/messages?'))return Response.json(url.includes('rfc822msgid')?{messages:[{id:'received'}]}:{messages:[]});
    if(url.includes('/messages/received'))return Response.json({id:'received',labelIds:['SPAM'],payload:{headers:[{name:'Message-ID',value:store.message(draft.id).rfc_id},{name:'From',value:'owner@gmail.com'},{name:'To',value:'office@example.com'}]}});
    throw Error(`Unexpected ${url}`);
  }});
  await gmail.send({id:draft.id,version:draft.version},'owner');await gmail.refreshMessage(draft.id,'owner');
  assert.equal(store.message(draft.id).placement,'unknown');
  store.run('INSERT INTO accounts(id,email,test_receiver,credentials,created_at) VALUES(?,?,?,?,?)','receiver','office@example.com',1,seal({access_token:'receiver',expires_at:Date.now()+3600000},env),store.now());
  await gmail.refreshMessage(draft.id,'owner');
  assert.equal(store.message(draft.id).placement,'spam');assert.equal(store.account('sender').status,'paused');
  assert.equal(store.snapshot().accounts.find(a=>a.id==='sender').total_sent,1);
});
test('delivery failure needs exact message identity, final recipient and failed DSN status',()=>{
  const draft={recipient:'office@example.com',rfc_id:'<id@gmail.com>'};
  const report={payload:{mimeType:'multipart/report',parts:[{body:{data:Buffer.from('Final-Recipient: rfc822; office@example.com\nAction: failed\nStatus: 5.1.1\n\nMessage-ID: <id@gmail.com>').toString('base64url')}}]}};
  assert.equal(isBounce(report,draft),true);assert.equal(isBounce(report,{...draft,rfc_id:'<different@gmail.com>'}),false);assert.equal(isBounce(report,{...draft,recipient:'other@example.com'}),false);
});
test('two connections cannot reserve beyond the daily limit or edit a submitted draft',async t=>{
  const {store,path}=await fixture(t),other=openOutreach(path,env);
  const first=store.saveDraft({record},'owner'),second=other.saveDraft({record:{...record,body:'Other'}},'owner');
  store.run('UPDATE accounts SET daily_limit=1');store.reserveSend({id:first.id,version:1},'owner');
  assert.throws(()=>other.reserveSend({id:second.id,version:1},'owner'),/limit/);
  assert.throws(()=>other.saveDraft({id:first.id,version:2,record},'owner'),/Only drafts/);
  other.close();
});
test('exact reply headers are detected; confirmed bounces suppress recipients',async t=>{
  const {store}=await fixture(t),draft=store.saveDraft({record},'owner');let bounce=false;
  const gmail=createGmail(store,{env,fetcher:async url=>{
    if(url.endsWith('/messages/send')) return Response.json({id:'outgoing',threadId:'thread'});
    if(url.includes('/threads/'))return Response.json({messages:[{id:'reply',internalDate:String(Date.now()+1000),payload:{headers:[{name:'From',value:'Office <office@example.com>'},{name:'In-Reply-To',value:store.message(draft.id).rfc_id}]}}]});
    if(url.includes('/messages?'))return Response.json({messages:bounce?[{id:'bounce'}]:[]});
    if(url.includes('/messages/bounce'))return Response.json({payload:{mimeType:'multipart/report',parts:[{body:{data:Buffer.from(`Final-Recipient: rfc822; office@example.com\nAction: failed\nStatus: 5.1.1\n\nMessage-ID: ${store.message(draft.id).rfc_id}`).toString('base64url')}}]}});
    throw Error('Unexpected request');
  }});
  await gmail.send({id:draft.id,version:1},'owner');await gmail.refreshMessage(draft.id,'owner');assert.ok(store.message(draft.id).replied_at);
  bounce=true;await gmail.refreshMessage(draft.id,'owner');assert.ok(store.message(draft.id).bounced_at);assert.equal(store.snapshot().suppression[0].value,record.recipient);
});
test('disconnect erases credentials while preserving sent history and Gmail errors pause sending',async t=>{
  const {store}=await fixture(t),draft=store.saveDraft({record},'owner');
  const gmail=createGmail(store,{env,fetcher:async()=>Response.json({error:'unauthorized'},{status:401})});
  await assert.rejects(gmail.send({id:draft.id,version:1},'owner'));
  assert.equal(store.account('sender').status,'reconnect-required');assert.equal(store.message(draft.id).state,'failed');
  const version=store.account('sender').version;
  await gmail.disconnect('sender','owner',version);
  assert.equal(store.account('sender').credentials,null);assert.equal(store.snapshot().messages.length,1);
});
test('fresh OAuth consent reconnects after a lost encryption key and readonly receivers cannot send',async t=>{
  const {store}=await fixture(t),newEnv={...env,OUTREACH_ENCRYPTION_KEY:'bb'.repeat(32)};
  const fetcher=async url=>Response.json(url.includes('/token')?{access_token:'new-access',refresh_token:'new-refresh',scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'}:{emailAddress:'owner@gmail.com'});
  await oauthFinish(store,'owner',{role:'sender',reconnect_id:'sender',verifier:'v'},'code',{env:newEnv,fetcher});
  assert.equal(unseal(store.account('sender').credentials,newEnv).refresh_token,'new-refresh');assert.equal(store.account('sender').can_send,1);
  const receiverFetch=async url=>Response.json(url.includes('/token')?{access_token:'read',refresh_token:'refresh',scope:'https://www.googleapis.com/auth/gmail.readonly'}:{emailAddress:'receiver@gmail.com'});
  const receiver=await oauthFinish(store,'owner',{role:'receiver',reconnect_id:'',verifier:'v'},'code',{env,fetcher:receiverFetch});
  assert.equal(store.account(receiver.id).can_send,0);assert.equal(store.account(receiver.id).test_receiver,1);
  const draft=store.saveDraft({record:{...record,account_id:receiver.id}},'owner');assert.throws(()=>store.reserveSend({id:draft.id,version:1},'owner'),/sending account/);
});
test('OAuth starts on the configured callback host before setting browser-bound state',async t=>{
  const {store}=await fixture(t),before=store.one('SELECT COUNT(*) AS n FROM oauth_states').n;
  const wrongHost=oauthStart(store,'owner',{role:'sender'},env,'http://localhost:3001');
  assert.equal(wrongHost.binding,null);assert.equal(new URL(wrongHost.url).origin,'http://127.0.0.1:3001');
  assert.equal(store.one('SELECT COUNT(*) AS n FROM oauth_states').n,before);
  const correct=oauthStart(store,'owner',{role:'sender'},env,'http://127.0.0.1:3001');
  assert.ok(correct.binding);assert.equal(new URL(correct.url).hostname,'accounts.google.com');
  assert.throws(()=>consumeOAuth(store,'owner',new URL(correct.url).searchParams.get('state'),'',env),error=>gmailConnectionCode(error)==='browser');
});
test('OAuth failures identify disabled API, missing scopes, invalid credentials and network failures without provider data',async t=>{
  const {store}=await fixture(t),pending={role:'sender',reconnect_id:'',verifier:'test-verifier'};
  const token={access_token:'access-DO-NOT-EXPOSE',refresh_token:'refresh-DO-NOT-EXPOSE',scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'};
  const cases=[
    ['api-disabled',async url=>url.includes('/token')?Response.json(token):Response.json({error:{details:[{reason:'SERVICE_DISABLED'}],message:'provider-private-data'}},{status:403})],
    ['permissions',async()=>Response.json({...token,scope:'https://www.googleapis.com/auth/gmail.send'})],
    ['credentials',async()=>Response.json({error:'invalid_client',error_description:'private-provider-details'},{status:401})],
    ['code',async()=>Response.json({error:'invalid_grant',error_description:'private-provider-details'},{status:400})],
    ['network',async()=>{throw new Error('private-network-details');}]
  ];
  for(const [expected,fetcher] of cases) {
    await assert.rejects(oauthFinish(store,'owner',pending,'private-code',{env,fetcher}),error=>{
      assert.equal(gmailConnectionCode(error),expected);assert.ok(!/DO-NOT-EXPOSE|private-|test-verifier/.test(error.message));return true;
    });
  }
  assert.equal(gmailConnectionCode(new Error('private-code')),'failed');
  assert.equal(gmailConnectionMessage('untrusted injected text'),gmailConnectionMessage('failed'));
  assert.equal(gmailConnectionCode(new GmailConnectionError('untrusted injected text')),'failed');
  assert.equal(store.one('SELECT COUNT(*) AS n FROM accounts').n,1);
});
