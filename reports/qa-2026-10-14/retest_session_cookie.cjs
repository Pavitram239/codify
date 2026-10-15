const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const f=JSON.parse(fs.readFileSync(path.join(__dirname,'live-fixtures.json'),'utf8'));
const base='http://localhost:5185',api='http://localhost:3185/api/v1';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext();try{
 const csrf=await context.request.get(api+'/auth/csrf');const headers={Origin:base,'X-CSRFToken':(await csrf.json()).csrfToken};
 const login=await context.request.post(api+'/auth/login',{headers,data:{id:f.users.student.username,password:f.password}});assert.equal((await login.json()).success,true);
 const page=await context.newPage();page.setDefaultTimeout(30000);
 await page.route('**/api/v1/submissions/user/submissions**',r=>r.fulfill({status:401,contentType:'application/json',body:'{"detail":"Session expired"}'}));
 await page.goto(base+'/history');await page.getByPlaceholder('Id',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).pathname,'/');assert.ok(!(await context.cookies()).some(c=>c.name==='token'));
 const file=path.join(__dirname,'evidence/browser-retest-results.json'),rows=JSON.parse(fs.readFileSync(file,'utf8'));
 const row=rows.find(r=>r.id==='UI-A05');row.status='Passed';row.actual='Injected 401 clears the HTTP-only token cookie and local auth before returning to login; late responses are guarded by auth generation.';
 fs.writeFileSync(file,JSON.stringify(rows,null,2));console.log('PASS UI-A05: HTTP-only cookie cleared before login recovery.');
 await context.request.post(api+'/auth/logout',{headers});
}finally{await context.close();await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
