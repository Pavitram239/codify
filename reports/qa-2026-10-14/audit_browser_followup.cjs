const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const f=JSON.parse(fs.readFileSync(path.join(__dirname,'live-fixtures.json'),'utf8'));
const file=path.join(__dirname,'evidence/browser-live-results.json');
const results=JSON.parse(fs.readFileSync(file,'utf8'));
const api=process.env.QA_API_URL || 'http://localhost:3185/api/v1',base=process.env.WORKSPACE_URL || 'http://localhost:5185';
function put(id,area,scenario,expected,actual,passed,extras={}) {const item={id,area,scenario,expected,actual,status:passed?'Passed':'Failed',role:'Faculty',method:'Live browser/API',steps:'',source:'',bug:'',...extras};const index=results.findIndex(r=>r.id===id);if(index<0)results.push(item);else results[index]=item;console.log(`${item.status} ${id}: ${actual.slice(0,160)}`);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  async function login(role,width=1440){const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});const csrf=await context.request.get(api+'/auth/csrf');const headers={Origin:base,'X-CSRFToken':(await csrf.json()).csrfToken};const response=await context.request.post(api+'/auth/login',{headers,data:{id:f.users[role].username,password:f.password}});if(!(await response.json()).success)throw Error('QA login failed');const page=await context.newPage();page.setDefaultTimeout(15000);return{context,page,headers};}
  const faculty=await login('faculty');
  await faculty.page.goto(base+'/problem-form/'+f.problemId);
  await faculty.page.getByPlaceholder('Enter test case input').nth(1).waitFor();
  const hidden=await faculty.page.getByRole('button',{name:/Hidden/}).count();
  put('UI-P01','Problem authoring','Existing problem including hidden tests opens for editing','Both visible and hidden cases appear in owner editing',`Owner edit form contains ${await faculty.page.getByPlaceholder('Enter test case input').count()} case editors and ${hidden} hidden control after API loading completes`,hidden===1,{steps:'Open an owned problem with one hidden and one visible case; wait for edit API loading to finish'});

  const student=await login('student',320);
  const history=await student.context.request.get(api+'/submissions/user/submissions');const historyJson=await history.json();const latest=historyJson.submissions[0]._id;
  const details=await student.context.request.get(api+'/submissions/'+latest);const detailJson=await details.json();const hiddenRows=detailJson.testCaseResults.filter(t=>t.is_hidden);
  const masks=hiddenRows.every(t=>/^\*+$/.test(t.input)&&/^\*+$/.test(t.expectedOutput)&&/^\*+$/.test(t.output));
  put('LIVE-S01','Submission privacy','Hidden case content is masked for the student','Hidden input/output contain masks without exposing actual data',`HTTP ${details.status()}; hidden results=${JSON.stringify(hiddenRows.map(t=>({input:t.input,output:t.output,expectedOutput:t.expectedOutput})))}`,masks,{role:'Student',steps:'Fetch a saved submission with a hidden test case; verify contents are masks, independent of mask length'});

  await student.page.goto(base+'/history');await student.page.getByText('QA temporary Pair Sum',{exact:true}).first().waitFor();await student.page.goto(base+'/submissions/'+latest);await student.page.getByRole('heading',{name:/’s submission$/}).waitFor();
  put('UI-S01','History and submissions','Student history and submission review open with real data','History lists real submissions and the review page renders','Live history and submission review loaded using the actual page title',true,{role:'Student',steps:'Open history then a saved submission review'});

  await student.page.goto(base+'/profile');await student.page.getByRole('heading',{name:'Recent Submissions',exact:false}).waitFor().catch(()=>{});await student.page.waitForTimeout(500);
  const overflow=await student.page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('#workspace-main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2).slice(0,8).map(e=>({tag:e.tagName,text:e.innerText?.slice(0,80),class:e.className}))}));
  await student.page.screenshot({path:path.join(__dirname,'evidence/profile-populated-320.png'),fullPage:false,animations:'disabled'});
  put('LIVE-R320-profile','Responsive UI','Populated student profile at 320px','No document-wide horizontal overflow',JSON.stringify(overflow),overflow.width<=overflow.viewport,{role:'Student',steps:'Create several submissions, then open the student profile at 320px',source:'client/src/componets/SubmissionPage.jsx / Profile/Profile.jsx',bug:'BUG-PROFILE-OVERFLOW'});

  await faculty.page.goto(base+'/contests/'+f.contestId+'/dashboard');await faculty.page.getByRole('button',{name:'Excel',exact:true}).waitFor();
  await faculty.page.waitForResponse(r=>r.url().includes('/dashboard?')).catch(()=>{});
  const excel=faculty.page.waitForEvent('download');await faculty.page.getByRole('button',{name:'Excel',exact:true}).click();const download=await excel;const exportPath=path.join(__dirname,'evidence/qa-rankings.xlsx');await download.saveAs(exportPath);
  put('LIVE-X01','Rankings and exports','Excel rankings export downloads successfully','Non-empty XLSX file downloads with current ranking data',`Downloaded XLSX: ${fs.statSync(exportPath).size} bytes`,fs.statSync(exportPath).size>1000,{steps:'Owner opens populated assessment dashboard → Excel'});
  const pdf=faculty.page.waitForEvent('download');await faculty.page.getByRole('button',{name:'PDF',exact:true}).click();const pdfDownload=await pdf;const pdfPath=path.join(__dirname,'evidence/qa-rankings.pdf');await pdfDownload.saveAs(pdfPath);
  put('LIVE-X02','Rankings and exports','PDF rankings export downloads successfully','Non-empty PDF file downloads with current ranking data',`Downloaded PDF: ${fs.statSync(pdfPath).size} bytes`,fs.statSync(pdfPath).size>1000,{steps:'Owner opens populated assessment dashboard → PDF'});

  // Validate the real registration → approval → first-login password change lifecycle.
  const guest=await browser.newContext();const register=await guest.request.post(api+'/auth/register',{data:{username:f.prefix+'signup',id:f.prefix+'22it002',role:'student',branch:'cspit-it',semester:6,batch:'a1',mobileNo:'9999999999',facultyId:f.users.faculty.id,subject:'QA test subject'}});const registerJson=await register.json();
  put('LIVE-REG01','Registration and approval','New student self-registration creates a pending request','HTTP 201 with approval pending',`HTTP ${register.status()}; success=${registerJson.success}`,register.status()===201,{role:'Guest',steps:'POST a valid student registration associated with the temporary faculty'});
  const pending=await faculty.context.request.get(api+'/faculty/get-pending-users?facultyId='+f.users.faculty.id);const pendingJson=await pending.json();const newUser=pendingJson.data.find(u=>u.username===f.prefix+'signup');
  const approval=await faculty.context.request.post(api+'/faculty/accept-request',{headers:faculty.headers,data:{userId:newUser._id||newUser.id,facultyId:f.users.faculty.id}});
  put('LIVE-REG02','Registration and approval','Owner faculty approves the pending student','HTTP 200 with the student approved',`HTTP ${approval.status()}`,approval.status()===200,{steps:'Owner faculty finds its pending test student and accepts the request'});
  const csrf=await guest.request.get(api+'/auth/csrf');const guestHeaders={Origin:base,'X-CSRFToken':(await csrf.json()).csrfToken};const initial=await guest.request.post(api+'/auth/login',{headers:guestHeaders,data:{id:f.prefix+'22it002',password:f.prefix+'22it002'}});const initialJson=await initial.json();
  put('LIVE-REG03','Registration and approval','First login requests a password change','firstTimeLogin=true, without granting an ordinary session',`HTTP ${initial.status()}; firstTimeLogin=${initialJson.firstTimeLogin}`,initialJson.firstTimeLogin===true,{role:'Student',steps:'Newly approved test student logs in with the existing initial-password policy'});
  const changed=await guest.request.post(api+'/auth/change-password',{headers:guestHeaders,data:{id:f.prefix+'22it002',oldPassword:f.prefix+'22it002',newPassword:'QaAuditChangedPassword-99!'}});
  const relogin=await guest.request.post(api+'/auth/login',{headers:guestHeaders,data:{id:f.prefix+'22it002',password:'QaAuditChangedPassword-99!'}});const reloginJson=await relogin.json();
  put('LIVE-REG04','Registration and approval','Student completes first-login password change','Strong password accepted and new password signs in',`Password change HTTP ${changed.status()}; new login success=${reloginJson.success}`,changed.status()===200&&reloginJson.success===true,{role:'Student',steps:'Change the approved test account password and sign in with the replacement'});
  await guest.request.post(api+'/auth/logout',{headers:guestHeaders});await guest.close();

  await student.context.request.post(api+'/auth/logout',{headers:student.headers});await student.context.close();await faculty.context.request.post(api+'/auth/logout',{headers:faculty.headers});await faculty.context.close();
}finally{fs.writeFileSync(file,JSON.stringify(results,null,2));await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
