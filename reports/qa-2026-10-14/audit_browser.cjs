const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'live-fixtures.json'), 'utf8'));
const output = path.join(__dirname, 'evidence');
const api = process.env.QA_API_URL || 'http://localhost:3185/api/v1';
const base = process.env.WORKSPACE_URL || 'http://localhost:5185';
const results = [];
let browser;

function record(id, area, scenario, expected, actual, passed, extras={}) {
  results.push({id, area, scenario, role:'Faculty', method:'Live browser/API', steps:'', inputs:'', expected, actual, status:passed?'Passed':'Failed', source:'', bug:'', ...extras});
  console.log(`${passed?'PASS':'FAIL'} ${id}: ${scenario}`);
}
async function check(id, area, scenario, expected, fn, extras={}) {
  try { const observed = await fn(); record(id,area,scenario,expected,observed.actual,observed.passed,extras); }
  catch(error) { record(id,area,scenario,expected,error.message.slice(0,900),false,{...extras,method:'Test interrupted; review evidence',bug:extras.bug||''}); }
}
async function session(role, width=1440) {
  const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'Asia/Kolkata'});
  const csrfResponse=await context.request.get(api+'/auth/csrf');
  const headers={Origin:base,'X-CSRFToken':(await csrfResponse.json()).csrfToken};
  const login=await context.request.post(api+'/auth/login',{headers,data:{id:fixtures.users[role].username,password:fixtures.password}});
  if(login.status()!==200 || !(await login.json()).success) throw Error(`Cannot authenticate temporary ${role} account (HTTP ${login.status()})`);
  const page=await context.newPage(); page.setDefaultTimeout(12000);
  return {context,page,headers,role};
}
async function closeSession(s) { await s.context.request.post(api+'/auth/logout',{headers:s.headers}); await s.context.close(); }

(async()=>{
  browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    // Authentication: validate the real form, including a malformed email response.
    for(const [id,input,scenario] of [['UI-A01','', 'Empty login fields are handled safely'],['UI-A02',fixtures.users.faculty.username,'Wrong password does not log in'],['UI-A03','bad@','Malformed email response does not crash the login page']]) {
      const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/');await page.getByPlaceholder('Id',{exact:true}).waitFor();
      if(input) await page.getByPlaceholder('Id',{exact:true}).fill(input);
      await page.getByPlaceholder('Password',{exact:true}).fill('DefinitelyIncorrect42!');
      await page.getByRole('button',{name:'Login',exact:true}).click();await page.waitForTimeout(700);
      const stillVisible=await page.getByPlaceholder('Id',{exact:true}).isVisible().catch(()=>false);
      record(id,'Authentication and sessions',scenario,'Login remains visible, shows a useful validation error and does not navigate',`Login visible=${stillVisible}; URL=${page.url()}; page errors=${JSON.stringify(errors)}`,stillVisible && errors.length===0,{role:'Guest',steps:'Open login; enter the scenario input and a wrong password; click Login',inputs:input||'Blank ID',source:'client/src/componets/Login.jsx:handleLogin',bug:id==='UI-A03'?'BUG-ERROR-TOAST':''});
      if(errors.length) await page.screenshot({path:path.join(output,'login-invalid-email.png'),animations:'disabled'}).catch(()=>{});
      await context.close();
    }

    const faculty=await session('faculty');
    await faculty.page.goto(base+'/browse');await faculty.page.getByRole('heading',{name:'Coming up',exact:true}).waitFor();
    record('UI-A04','Authentication and sessions','Faculty live login and home data','Authenticated home with actual API data',`Home loaded for temporary faculty`,true,{steps:'Sign in as the approved temporary faculty account'});

    await check('UI-PR01','Profile','Profile edits persist on the server','The API stores the edited name and shows successful save',async()=>{
      await faculty.page.goto(base+'/profile');await faculty.page.getByRole('button',{name:'Edit Details',exact:true}).click();
      await faculty.page.locator('input[name=name]').fill('QA Updated Faculty');
      const responsePromise=faculty.page.waitForResponse(r=>r.url().endsWith('/user/update')&&r.request().method()==='PUT');
      await faculty.page.getByRole('button',{name:'Save Changes',exact:true}).click();const response=await responsePromise;
      const current=await faculty.context.request.get(api+'/auth/get-current-user');const data=await current.json();
      return {passed:response.status()===200&&data.user.profile.name==='QA Updated Faculty',actual:`Save HTTP ${response.status()}; persisted name=${data.user.profile.name}`};
    },{steps:'Profile → Edit Details → change Full Name → Save Changes',source:'client/src/componets/Profile/Profile.jsx:handleSubmit'});

    await check('UI-PR02','Profile','Account identity updates immediately after profile save','Header and sidebar use the new name without refreshing',async()=>{
      await faculty.page.waitForTimeout(500);const label=await faculty.page.locator('.workspace-profile').getAttribute('aria-label');
      return {passed:label==='Account for QA Updated Faculty',actual:`Account link label after successful save: ${label}`};
    },{steps:'Save Full Name as QA Updated Faculty; inspect the header account label before refreshing',source:'client/src/componets/Profile/Profile.jsx:handleSubmit',bug:'BUG-PROFILE-STATE'});

    await check('UI-PR03','Profile','Profile fields have associated labels','Full Name can be located through its label',async()=>{
      await faculty.page.getByRole('button',{name:'Edit Details',exact:true}).click();
      await faculty.page.locator('input[name=name]').waitFor();const count=await faculty.page.getByLabel('Full Name',{exact:true}).count();
      return {passed:count===1,actual:`Inputs matched by label Full Name: ${count}`};
    },{steps:'Open profile editing; inspect label-to-input association',source:'client/src/componets/Profile/ProfileRight.jsx',bug:'BUG-FIELD-LABELS'});

    await check('UI-P01','Problem authoring','Existing problem including hidden tests opens for editing','Both visible and hidden cases appear in the owner edit form',async()=>{
      await faculty.page.goto(base+'/problem-form/'+fixtures.problemId);await faculty.page.getByRole('heading',{name:'Edit Problem',exact:true}).waitFor();
      const count=await faculty.page.getByPlaceholder('Enter test case input').count();const hidden=await faculty.page.getByRole('button',{name:/Hidden/}).count();
      return {passed:count===2&&hidden===1,actual:`Test case editors=${count}; hidden controls=${hidden}`};
    },{steps:'Owner opens Edit Problem for a problem with one visible and one hidden test'});

    await check('UI-F01','Student management','Add-student modal closes with Escape','Escape closes the modal and restores focus to its trigger',async()=>{
      await faculty.page.goto(base+'/add-student-using-file');await faculty.page.getByRole('button',{name:'Add Single Student',exact:true}).click();
      await faculty.page.getByRole('heading',{name:'Add Student',exact:true}).waitFor();await faculty.page.keyboard.press('Escape');await faculty.page.waitForTimeout(150);
      const visible=await faculty.page.getByRole('heading',{name:'Add Student',exact:true}).isVisible();
      await faculty.page.screenshot({path:path.join(output,'student-dialog-escape.png'),animations:'disabled'});
      await faculty.page.getByRole('button',{name:'Cancel',exact:true}).click();
      return {passed:!visible,actual:`Add Student dialog still visible after Escape=${visible}`};
    },{steps:'Bulk registration → Add Single Student → Escape',source:'client/src/componets/Faculty/StudentRegister.jsx',bug:'BUG-DIALOG-KEYBOARD'});

    const student=await session('student');
    await check('UI-P02','Problem access','Student opens an assigned active-assessment problem','Statement opens with no hidden test inputs exposed',async()=>{
      await student.page.goto(base+'/problems/'+fixtures.problemId);await student.page.getByRole('heading',{name:'QA temporary Pair Sum',exact:true}).waitFor();
      const text=await student.page.locator('#workspace-main').innerText();return {passed:text.includes('Read two integers')&&!text.includes('4 5'),actual:'Statement loaded; hidden test input 4 5 absent from page'};
    },{role:'Student',steps:'Open the temporary assigned problem during its active assessment'});

    await check('UI-E01','Code editor','Editor loads successfully','A working Monaco editor is available',async()=>{
      await student.page.locator('.monaco-editor').waitFor({timeout:30000});
      const languages=await student.page.evaluate(()=>window.monaco?.editor.getModels().map(m=>m.getLanguageId())||[]);
      return {passed:languages.length>0,actual:`Loaded editor model languages=${languages.join(',')}`};
    },{role:'Student',steps:'Open problem and wait for the code editor'});

    await check('UI-E02','Code editor','Changing execution language updates editor syntax mode','Selecting Python changes the editor model language to python',async()=>{
      await student.page.locator('#language').selectOption('python');await student.page.waitForTimeout(200);
      const languages=await student.page.evaluate(()=>window.monaco?.editor.getModels().map(m=>m.getLanguageId())||[]);
      return {passed:languages.includes('python'),actual:`Selected execution language=python; editor model language=${languages.join(',')}`};
    },{role:'Student',steps:'Open Java problem editor; select Python; inspect current editor model language',source:'client/src/componets/CodeEditor/CodeEditorArea.jsx',bug:'BUG-EDITOR-LANGUAGE'});

    await check('UI-E03','Code drafts','Save and retrieve a per-language code draft','Draft persists exactly for the student and problem',async()=>{
      const codeByLanguage={python:'a,b=map(int,input().split()); print(a+b)',java:'class Main {}',cpp:'int main(){return 0;}'};
      const saved=await student.context.request.post(api+'/compile/saveCode',{headers:student.headers,data:{problemId:fixtures.problemId,codeByLanguage}});
      const loaded=await student.context.request.get(api+'/compile/getCode?problemId='+fixtures.problemId);const json=await loaded.json();
      return {passed:saved.status()===200&&json.code.python===codeByLanguage.python,actual:`Save HTTP ${saved.status()}; retrieved Python source matches=${json.code.python===codeByLanguage.python}`};
    },{role:'Student',steps:'Save Java, Python and C++ drafts for the temporary problem; retrieve draft API'});

    const executions=[
      ['LIVE-E01','Correct Python answer', 'python','a,b=map(int,input().split()); print(a+b)',true,20],
      ['LIVE-E02','Wrong Python answer','python','print(0)',false,0],
      ['LIVE-E03','Python runtime exception','python','raise RuntimeError("QA runtime failure")',false,0],
      ['LIVE-E04','Python syntax error','python','this is not valid python !',false,0],
      ['LIVE-E05','Python time limit','python','while True: pass',false,0],
      ['LIVE-E06','Correct C++ answer','cpp','#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;}',true,20],
      ['LIVE-E07','Correct Java answer','java','import java.util.*; public class Main { public static void main(String[]args){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}',true,20],
    ];
    let lastSubmission;
    for(const [id,scenario,language,code,allPassed,marks] of executions){
      await check(id,'Code execution and grading',scenario,`HTTP 200; allPassed=${allPassed}; marks=${marks}`,async()=>{
        const response=await student.context.request.post(api+'/compiler/run-code',{headers:student.headers,timeout:90000,data:{code,language,problemId:fixtures.problemId,allTestCases:true}});
        const json=await response.json();if(json.savedSubmission)lastSubmission=json.savedSubmission._id;
        return {passed:response.status()===200&&json.allPassed===allPassed&&json.savedSubmission?.totalMarks===marks,actual:`HTTP ${response.status()}; allPassed=${json.allPassed}; marks=${json.savedSubmission?.totalMarks}; results=${JSON.stringify(json.testResults?.map(t=>({passed:t.passed,error:t.error})))}`};
      },{role:'Student',steps:`Submit ${language} code against one visible and one hidden case`,inputs:code,source:'apps/execution/services.py / views.py'});
    }

    await check('LIVE-S01','Submission privacy','Hidden case content is masked for the student','Student submission detail masks hidden input/output',async()=>{
      const response=await student.context.request.get(api+'/submissions/'+lastSubmission);const json=await response.json();const hidden=json.testCaseResults?.filter(t=>t.is_hidden);
      return {passed:response.status()===200&&hidden?.every(t=>t.input==='******'&&t.expectedOutput==='******'),actual:`HTTP ${response.status()}; hidden results=${JSON.stringify(hidden?.map(t=>({input:t.input,output:t.output,expectedOutput:t.expectedOutput})))}`};
    },{role:'Student',steps:'Fetch latest own submission after running all cases'});

    await check('UI-S01','History and submissions','Student history and submission review open with real data','History contains the submitted problem and review opens',async()=>{
      await student.page.goto(base+'/history');await student.page.getByText('QA temporary Pair Sum',{exact:true}).first().waitFor();
      await student.page.goto(base+'/submissions/'+lastSubmission);await student.page.getByRole('heading',{name:/Submission review/}).waitFor();
      return {passed:true,actual:'Live history and submission review rendered successfully'};
    },{role:'Student',steps:'Open history after submissions, then open own submission review'});

    await check('UI-GAP01','Problem access','Solution tab has usable content or an explicit unavailable state','Solution is available or the tab clearly explains its availability policy',async()=>{
      await student.page.goto(base+'/problems/'+fixtures.problemId);await student.page.getByRole('button',{name:'Solution',exact:true}).click();
      const text=await student.page.locator('#workspace-main').innerText();const placeholder=text.includes('Here, you can view the solution or editorial');
      return {passed:!placeholder,actual:placeholder?'Solution tab displays generic placeholder text; no editorial publishing data model exists':'Non-placeholder solution state'};
    },{role:'Student',steps:'Open any problem → Solution',source:'client/src/componets/Problem/Solution.jsx',bug:'GAP-SOLUTION'});

    // Width, auth recovery and failure paths for real, seeded pages.
    for(const width of [320,768,1440]){
      await student.page.setViewportSize({width,height:1000});
      for(const route of ['/browse','/make-contest','/make-problem','/profile','/history','/problems/'+fixtures.problemId]){
        await student.page.goto(base+route);await student.page.locator('.workspace').waitFor();await student.page.waitForTimeout(300);
        const fits=await student.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
        record(`LIVE-R${width}-${route.split('/')[1]}`,'Responsive UI',`${route.split('/')[1]} populated student page at ${width}px`,'No document-wide horizontal overflow',`Viewport=${width}; horizontal overflow=${!fits}`,fits,{role:'Student',steps:`Open ${route} with seeded content at ${width}px`});
      }
    }

    await student.page.setViewportSize({width:1440,height:1000});
    await check('UI-P03','Problem access','Missing problem displays an error instead of infinite loading','A 404 response yields a clear not-found message and a return action',async()=>{
      const missing='00000000-0000-4000-8000-000000000000';await student.page.goto(base+'/problems/'+missing);await student.page.waitForResponse(r=>r.url().includes('/problems/'+missing)&&r.status()===404).catch(()=>{});await student.page.waitForTimeout(400);
      const text=await student.page.locator('#workspace-main').innerText();const stuck=text.includes('Loading problem details');
      return {passed:!stuck,actual:`After HTTP 404, page text=${text.slice(0,200)}`};
    },{role:'Student',steps:'Open a well-formed but non-existent problem UUID',source:'client/src/componets/Problem/ProblemShow.jsx',bug:'BUG-PROBLEM-ERROR'});

    await student.page.goto(base+'/profile');await student.page.locator('.workspace').waitFor();
    await check('UI-A05','Authentication and sessions','Expired session is handled during navigation','An HTTP 401 redirects to login or offers reauthentication',async()=>{
      await student.page.route('**/api/v1/submissions/user/submissions**',r=>r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({detail:'Session expired'})}));
      await student.page.getByRole('link',{name:'History',exact:true}).first().click();await student.page.waitForTimeout(500);
      const text=await student.page.locator('#workspace-main').innerText();return {passed:student.page.url()===base+'/'||text.toLowerCase().includes('sign in'),actual:`URL after API 401=${student.page.url()}; page=${text.slice(0,220)}`};
    },{role:'Student',steps:'Inject a controlled 401 for the next history request while navigating in an existing session',method:'Browser with injected API 401',source:'client/src/utils/axiosInstance.js',bug:'BUG-SESSION-RECOVERY'});

    await closeSession(student);await closeSession(faculty);
    // Verify guest deep links redirect before private content renders.
    const guest=await browser.newContext();const guestPage=await guest.newPage();await guestPage.goto(base+'/profile');await guestPage.getByPlaceholder('Id',{exact:true}).waitFor();
    record('UI-A06','Role permissions','Unauthenticated deep link returns to login','Login rendered; no private profile content',`URL=${guestPage.url()}`,guestPage.url()===base+'/',{role:'Guest',steps:'Open /profile in a clean browser context'});await guest.close();
  } finally {
    fs.writeFileSync(path.join(output,'browser-live-results.json'),JSON.stringify(results,null,2));
    if(browser)await browser.close();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
