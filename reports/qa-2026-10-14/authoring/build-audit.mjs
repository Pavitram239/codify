import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const root=path.resolve(import.meta.dirname,'../../..');
const evidence=path.join(root,'reports/qa-2026-10-14/evidence');
const out=path.join(root,'outputs/01a12c0c-0888-7d53-94e2-75261c5185d7');
const read=async name=>JSON.parse(await fs.readFile(path.join(evidence,name),'utf8'));
const api=await read('api-boundaries.json');
const browser=(await read('browser-live-results.json')).filter(r=>r && r.id && r.status);
// Every registry entry maps to preserved observations; priorities are audit judgments.
const definitions=[
 ['BUG-SUBMISSION-ACCESS','P1','Security flaw','Other faculty can read private submissions','Student source, scores and hidden test data can be disclosed across faculty boundaries.','Apply owner/admin object permission checks to submission detail and problem rosters.','Unrelated faculty receive 403; owner and authorized admin retain access.'],
 ['BUG-STAFF-REVOKE','P1','Security flaw','Staff tokens survive password changes','A retained faculty/admin token still authenticates after a password change.','Track a token version or password-change timestamp for all roles and invalidate older tokens.','Old staff tokens return 401; newly issued tokens work.'],
 ['BUG-PREDICTABLE-PASSWORD','P1','Security flaw','Initial passwords use public identifiers','An approved new account can be claimed using its known student ID or email prefix.','Use a random, single-use invitation or reset token with expiry and secure delivery.','Public identifiers cannot authenticate or authorize first-password setup.'],
 ['BUG-DUPLICATE-EMAIL','P1','Security flaw','Profile updates allow duplicate login emails','Email login becomes ambiguous when two accounts share an address.','Normalize email, validate uniqueness on all write paths and enforce the agreed uniqueness constraint.','Duplicate updates return a field error; both original account identities remain intact.'],
 ['BUG-PARTIAL-UPDATE','P1','Defect','Rejected problem edits still replace samples','A 400 response can leave existing sample data changed.','Validate the complete payload before writes; wrap all nested changes in one transaction.','An invalid update preserves every original field, sample and test case.'],
 ['BUG-SHARED-ASSIGNMENT','P1','Defect','Removing one assessment removes shared access','Students lose a problem still assigned through another active assessment.','Derive effective access from remaining assignment sources before removing a problem relationship.','Delete/unassign one of two assessments; the other still permits reads and execution.'],
 ['BUG-JUDGE-STATUS','P1','Defect','Failed executions can receive full marks','An empty expected output matches empty stdout even when the judge reports failure.','Require an accepted judge status before comparing output and awarding marks.','Every non-accepted status fails with zero marks, including empty-output cases.'],
 ['BUG-MEMORY-ENFORCEMENT','P1','Defect','Memory budgets silently increase','A live 8 MB limit accepted a program using 23.10 MB and awarded marks.','Enforce the requested budget or reject unsupported limits with an explicit supported minimum.','A program exceeding the effective configured budget fails; UI and judge limits agree.'],
 ['BUG-VALIDATION','P2','Defect','Problem fields accept invalid values','Blank titles, unknown difficulty and coerced limits/booleans create inconsistent problems.','Use write serializers for trimmed strings, allowed difficulty, numeric limits and strict booleans.','All linked invalid inputs return 400 without mutation; valid create/edit still succeeds.'],
 ['BUG-MALFORMED','P2','Defect','Malformed problem payloads cause server errors','Null/string nested cases, malformed samples and long titles produce HTTP 500.','Validate nested structure, lengths and numeric types before database operations.','All linked malformed payloads return structured 400 responses with no partial writes.'],
 ['BUG-MARKS','P2','Defect','Invalid marks crash or corrupt totals','Negative marks produce 500; nonnumeric/fractional values are silently changed and totals disagree.','Define integer nonnegative marks and calculate totals from validated saved cases.','Invalid marks return 400; saved total equals the sum of case marks.'],
 ['BUG-ASSIGN-ID','P2','Defect','Malformed assignment IDs cause HTTP 500','Invalid UUID values break assessment assignment requests.','Validate a list of UUIDs before querying and report unknown IDs explicitly.','Invalid IDs return 400 and existing assignments remain unchanged.'],
 ['BUG-PAGINATION','P2','Defect','Malformed pagination causes HTTP 500','Faculty/session administration fails for bad or negative page parameters.','Centralize pagination parsing, bounds and consistent error/fallback behavior.','All malformed page/limit inputs return a documented safe response, never 500.'],
 ['BUG-COMPILER-VALIDATION','P2','Defect','Invalid language types crash execution','A list value reaches string operations and raises a server error.','Validate language and source types with an explicit supported-language choice.','Malformed language returns 400 before any judge request.'],
 ['BUG-DRAFT-VALIDATION','P2','Defect','Draft API accepts non-text source','Objects can be saved as code and later supplied to the editor.','Validate codeByLanguage as supported language keys with string values.','Non-text drafts return 400; existing valid code remains readable.'],
 ['BUG-CONTEST-TIME','P2','Defect','Partial date updates allow reversed windows','Updating one date bypasses validation against the existing other date.','Validate the combined existing and proposed start/end values.','End-before-start updates return 400 without changing either date.'],
 ['BUG-CONTEST-PROBLEMS','P2','Defect','Unknown problem IDs are silently omitted','Assessment creation reports success while its requested problem is absent.','Validate every supplied problem ID and access permission before creation.','Unknown IDs return 400/404 and no incomplete assessment is created.'],
 ['BUG-INACTIVE-LOGIN','P2','Security flaw','Inactive accounts receive login tokens','A disabled faculty account is reported successfully logged in.','Reject inactive users during credential verification and token issuance.','Inactive accounts receive no token/cookie; reactivated valid accounts work.'],
 ['BUG-AVATAR-VALIDATION','P2','Defect','Avatar upload accepts text files','Invalid image content is persisted as a successful avatar.','Decode and validate images before replacing the old avatar; define size/type limits.','Non-images return 400 and preserve the existing avatar.'],
 ['BUG-PROFILE-VALIDATION','P2','Defect','Profile accepts invalid dates and URL schemes','Invalid birthday text and javascript URLs are stored. No browser script execution was demonstrated.','Validate dates and allow appropriate https/http URL schemes on profile writes.','Invalid dates and unsafe URL schemes return field errors without mutation.'],
 ['BUG-RANK-SORT','P2','Defect','Display sorting changes earned rank','The lower score becomes rank 1 when the table is sorted ascending.','Compute ranking from scoring rules once, then sort the displayed rows independently.','Highest-scoring student keeps rank 1 across every display sort.'],
 ['BUG-RANK-TIMEZONE','P2','Defect','Ranking times are unlabelled UTC','Ranking time differs from the application’s IST assessment display.','Return an ISO timestamp and render a consistent timezone with a visible label.','00:30 UTC is displayed as 06:00 IST or explicitly labelled UTC.'],
 ['BUG-ERROR-TOAST','P2','Defect','Malformed login input crashes the page','Backend validation objects are rendered directly as toast content.','Normalize error payloads to readable strings and retain a recoverable login screen.','Malformed email/ID shows a clear error with the login form still usable.'],
 ['BUG-PROFILE-STATE','P2','Defect','Saved profile leaves identity displays stale','Header and sidebar still show the old name until refresh.','Update the shared authenticated-user state after successful profile writes.','New identity appears immediately in profile, header and sidebar.'],
 ['BUG-PROFILE-NO-EMAIL','P2','Defect','Accounts without email cannot save profiles','A read-only blank email is required by the profile save handler.','Permit valid updates for allowed email-null accounts or offer a validated editable email field.','An allowed account without email can save its valid name change.'],
 ['BUG-FIELD-LABELS','P2','Accessibility','Profile labels are not associated with controls','Assistive tools cannot identify inputs by their visible labels.','Give controls unique IDs and connect labels with htmlFor; audit all forms.','Profile controls are found by accessible label and work with keyboard/screen readers.'],
 ['BUG-DIALOG-KEYBOARD','P2','Accessibility','Add-student dialog ignores Escape','The modal remains open after Escape. Focus containment still needs separate testing.','Provide Escape dismissal, dialog semantics, focus handling and focus restoration.','Escape closes the dialog and returns focus to the opening control.'],
 ['BUG-EDITOR-LANGUAGE','P2','Defect','Editor syntax mode does not follow language','Selecting Python changes execution language while the Monaco model remains Java.','Control Monaco language with the selected language rather than defaultLanguage only.','Python/C++/Java selection updates both execution and editor syntax mode.'],
 ['BUG-PROFILE-OVERFLOW','P2','Defect','Populated profile overflows at 320 px','Recent submission cards increase document width to 344 px.','Allow flexible text content to shrink/wrap and keep action icons within the card.','At 320 px the populated profile has no horizontal page overflow.'],
 ['BUG-PROBLEM-ERROR','P2','Defect','Missing problems stay on loading forever','A problem 404 leaves the page saying Loading problem details.','Add explicit loading, success, missing and failure states with a recovery action.','Unknown problem shows a clear missing state instead of indefinite loading.'],
 ['BUG-SESSION-RECOVERY','P2','Defect','Expired sessions leave users stuck','401 navigation is not converted to reauthentication; expired-cookie logout does not clear the cookie.','Centralize 401 recovery and make logout clear invalid cookies safely.','Expired sessions return to login; logout clears expired cookies without a dead end.'],
 ['BUG-ROLE-ROUTES','P2','Defect','Students can render staff-only pages','Direct links render staff actions despite API 403. Backend role checks passed.','Apply role-aware route guards and display a clear access-denied state.','Student deep links to staff routes show no staff actions; staff navigation still works.'],
 ['BUG-RANDOM-STATUS','P2','Defect','Missing submission status becomes a random result','A controlled null API status is replaced with a fabricated status.','Remove random fallback; use Unknown/unavailable and safe display mapping.','Missing/unknown status never shows an invented accepted/rejected result.'],
 ['BUG-BULK-RETRY','P2','Defect','Failed bulk-registration rows are discarded','A per-row duplicate error removes the row instead of retaining it for correction.','Remove only successful rows and retain failed rows with their error messages.','Mixed success retains every failed row and allows correction/retry.'],
 ['GAP-SOLUTION','P2','Feature gap','Solution tab contains generic placeholder','The solution tab offers no usable editorial or explicit unavailable state.','Define editorial authoring/access rules; implement content or a truthful unavailable state.','Published solutions render correctly; unpublished solutions show unavailable.'],
 ['BUG-AVATAR-MIME','P3','Defect','PNG avatars are served as JPEG','The response Content-Type does not match PNG data.','Serve the validated stored image MIME type.','PNG download returns image/png; other supported formats match their bytes.'],
 ['BUG-SAVE-LABEL','P3','Defect','Draft button says Save Codez','An accidental label is visible in the editor.','Change the label to Save Code and check adjacent copy.','The draft-save action consistently displays Save Code.'],
 ['BUG-LINT','P3','Code quality','Full client lint check fails','240 errors and 11 warnings across 52 files; these are not 251 confirmed runtime bugs.','Triage unused code, prop validation and lint configuration; restore a meaningful clean quality check.','Full lint succeeds or documented exclusions cover unused legacy files without hiding active defects.'],
];
const extra=[{id:'ENG-01',area:'Code quality',scenario:'Full client lint check',role:'Developer',method:'Static lint',steps:'Run ESLint over the client and preserve its JSON output',inputs:'77 client files',expected:'No unresolved lint errors',actual:'240 errors and 11 warnings in 52 of 77 files. Includes unused legacy components and configuration issues; not all are runtime defects.',status:'Failed',source:'evidence/eslint.json',bug:'BUG-LINT'},
 {id:'ENV-01',area:'Environment',scenario:'Application login after port migration',role:'Admin',method:'Live browser/API',steps:'Open localhost:5185 and log in with the configured local admin',inputs:'Frontend 5185; API 3185/8185',expected:'Login returns 200 and opens /browse',actual:'HTTP 200; browser reached /browse and displayed Coming up. Docker mappings verified.',status:'Passed',source:'client/scripts/verify-login.cjs; docker compose ps',bug:''}];
const raw=[...api,...browser,...extra];
const grouped=new Map();
for(const row of raw.filter(r=>r.status==='Failed')){if(!grouped.has(row.bug))grouped.set(row.bug,[]);grouped.get(row.bug).push(row);}
for(const key of grouped.keys())if(!definitions.some(d=>d[0]===key))throw Error('Unmapped failure '+key);
const idMap=new Map(definitions.map((d,i)=>[d[0],`B${String(i+1).padStart(3,'0')}`]));
const scenarios=raw.map(r=>({...r,bug:idMap.get(r.bug)||'',evidence:r.id.startsWith('API-')?'evidence/api-boundaries.json + api-boundaries.xml':r.id.startsWith('UI-')||r.id.startsWith('LIVE-')||r.id.startsWith('REG-')?'evidence/browser-live-results.json':r.source}));
const xml=await fs.readFile(path.join(evidence,'backend-regression.xml'),'utf8');
const decode=s=>s.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
let n=0;
for(const m of xml.matchAll(/<testcase\s+([^>]+)\/>/g)){
 const attrs=Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(a=>[a[1],decode(a[2])]));
 const module=attrs.classname.split('.').slice(0,attrs.classname.split('.').findIndex(x=>x.startsWith('test_'))+1).join('/');
 scenarios.push({id:`REGRESSION-${String(++n).padStart(3,'0')}`,area:attrs.classname.split('.')[1],scenario:attrs.name.replace(/^test_/,'').replaceAll('_',' '),role:'As defined in test fixture',method:'Backend regression (isolated DB; mocks where defined)',steps:'Execute pytest test '+attrs.classname+'::'+attrs.name,inputs:'Fixtures and assertions in '+module+'.py',expected:'All assertions in this existing regression test succeed',actual:`Passed in ${attrs.time} seconds`,status:'Passed',bug:'',source:module+'.py',evidence:'evidence/backend-regression.xml'});
}
if(n!==103)throw Error('Unexpected regression test count '+n);
const layout=await fs.readFile(path.join(evidence,'route-layout.log'),'utf8');
let l=0;
for(const m of layout.matchAll(/^(320|768|1440) (\/\S*)$/gm))scenarios.push({id:`LAYOUT-${String(++l).padStart(3,'0')}`,area:'Page layouts',scenario:`${m[2]} at ${m[1]} px`,role:'Route-specific fixture role',method:'Browser with controlled API fixtures',steps:`Run verify-application.cjs; navigate ${m[2]} at ${m[1]} px`,inputs:'Controlled route fixtures; Edge browser',expected:'Page renders without checked layout overflow/errors; role navigation assertions pass',actual:'Passed fixture-based route/layout assertions',status:'Passed',bug:'',source:'client/scripts/verify-application.cjs',evidence:'evidence/route-layout.log; evidence/layout/'});
if(l!==96)throw Error('Unexpected layout count '+l);

// These release scenarios are explicitly a plan, not claimed test execution.
const pendingGroups=[
 ['Authentication','Guest / all roles',[
 ['Concurrent registration of the same ID','Register the same ID simultaneously from two clients','One account is created; the other request gets a clear duplicate error'],
 ['Concurrent email changes','Change two profiles to the same normalized email at once','The agreed uniqueness rule is enforced without ambiguous login'],
 ['Multiple-tab logout','Log out in one tab and attempt a protected write in another','The other tab requires reauthentication and cannot write'],
 ['Password reset end to end','Run the agreed password recovery flow with valid, expired and reused tokens','Only valid single-use tokens reset the intended account; confirm whether this feature is required'],
 ['Repeated failed-login policy','Apply the agreed failed-login/rate-limit threshold','Document and enforce the agreed limit with clear recovery'],
 ['Deleted-account token replay','Delete a temporary account and replay its token','Protected reads and writes are denied'],
 ['Approval revoked during a session','Revoke an account approval while a session is open','Access follows the agreed revocation policy'],
 ['First-password setup replay','Reuse a consumed initial-password invitation','The reused invitation cannot change credentials'],
 ]],
 ['Registration and bulk upload','Faculty / admin',[
 ['Mixed-success bulk registration','Upload valid, duplicate and malformed rows together','Successful rows persist; failed rows remain with precise errors'],
 ['Duplicates within one uploaded file','Upload two rows with the same student ID/email','Duplicate handling is explicit with no duplicate accounts'],
 ['Unsupported upload format','Supply a text or executable file in the import flow','Unsupported files are rejected without a page crash'],
 ['Large import boundary','Import at, below and above the agreed file/row limits','Enforce documented limits; avoid timeouts or silent truncation'],
 ['Empty and header-only import','Upload a workbook containing no student rows','Display a clear empty-input message without creating users'],
 ['Spreadsheet formula cells','Import rows containing formulas instead of literal required fields','Do not execute formulas; apply documented import interpretation'],
 ['Approval race','Two staff users approve/decline the same request simultaneously','One consistent final state and clear responses'],
 ['Faculty deletion with owned content','Delete a temporary faculty owning students/problems/assessments','Apply documented retention/cascade policy and protect unrelated users'],
 ]],
 ['Problem authoring','Faculty / admin',[
 ['Atomic nested update under database failure','Force an isolated database error midway through nested update','All old data remains unchanged'],
 ['Concurrent edit conflict','Edit the same problem from two browser tabs','Document last-write/version policy; avoid unnoticed data loss'],
 ['Zero-test-case policy','Create/publish a problem with no test cases','Enforce the agreed publish requirement and truthful scoring'],
 ['Duplicate case ordering','Add/reorder/remove nested cases rapidly','Stable case order and correct total marks survive reload'],
 ['Long Unicode problem content','Use multiline Unicode, emoji and long permitted text','Content round-trips without clipping or encoding loss'],
 ['Description injection','Render HTML/script-looking problem text in every reader','Content is safely escaped or sanitized; no executable script'],
 ['Delete problem with saved submissions','Delete a temporary problem with history/drafts','Apply agreed retention policy with clear confirmation and no unrelated deletion'],
 ['All numeric resource boundaries','Test numeric strings, NaN-like values, extremes and omitted limits','Apply a single documented type/range policy across create/edit'],
 ]],
 ['Assessments and permissions','All roles',[
 ['Exact start boundary','Read, draft, run and submit immediately before/at/after start','Access matches the documented inclusive/exclusive start policy'],
 ['Exact end boundary','Run/submit immediately before/at/after end','Cutoff policy is consistent between API and interface'],
 ['In-flight job crosses end time','Submit before end; complete execution after end','Marking follows a documented submission-time policy'],
 ['Timezone and daylight-saving entry','Create/edit from another timezone through a daylight-saving transition','Displayed time and stored UTC refer to the intended instant'],
 ['Independent direct and assessment assignments','Remove one assignment source while another remains','All remaining valid sources preserve effective access'],
 ['Student removed during assessment','Unassign a student while its problem editor is open','Next protected actions enforce current assignment'],
 ['Problem changed during live assessment','Edit cases/marks after students start','Apply documented version/freeze policy consistently'],
 ['Owner transfer and admin override policy','Try authorized/unauthorized content ownership changes','Only the documented roles can transfer or override ownership'],
 ]],
 ['Execution and grading','Student / worker',[
 ['Memory limit across Java/Python/C++','Run below/at/above supported limits in each language','Judge enforces the limit shown in the interface'],
 ['CPU time boundary in all languages','Run controlled programs near each configured timeout','Timing and marks follow the documented limits'],
 ['Large stdout/stderr','Emit output at and above the agreed output cap','Execution is bounded; UI/API remain responsive and hide hidden details'],
 ['Filesystem isolation','Use isolated test submissions attempting access outside their sandbox','No host or other submission files are accessible'],
 ['Network isolation','Use isolated submissions attempting external/private network access','Access follows the documented sandbox network policy'],
 ['Worker restart during execution','Restart a worker during temporary jobs','Jobs retry/recover without duplicate marks or indefinite pending status'],
 ['Duplicate submit clicks','Click Submit repeatedly and replay the same request','Apply agreed idempotency policy and avoid confusing duplicates'],
 ['Simultaneous submissions and queue load','Submit a documented concurrency level from temporary accounts','Queue remains bounded, fair and recoverable under the agreed load'],
 ]],
 ['Drafts and recovery','Student',[
 ['Draft reload persistence','Save each language, refresh and relogin','Each language restores its own latest saved source'],
 ['Offline draft save','Disconnect during Save and reconnect','Show truthful failure/retry behavior without losing local text'],
 ['Slow save then language switch','Delay save response while switching language/problem','No stale response overwrites another language or problem'],
 ['Two-tab draft conflict','Edit/save the same draft in two tabs','Document conflict behavior and prevent unnoticed stale overwrites'],
 ['Storage quota/private mode','Exercise restricted or full browser storage','Editor recovers with useful messaging and preserves current text'],
 ['Invalid stored draft response','Inject null/object/missing language fields','Editor handles invalid data safely without a blank page'],
 ['Navigation with unsaved source','Navigate away and back after an unsaved edit','Follow agreed autosave/warning policy and avoid unexpected loss'],
 ['Very large source file','Paste code near/above the agreed source-size limit','Reject or support it clearly without freezing the interface'],
 ]],
 ['Profile, history and rankings','All roles',[
 ['Avatar replacement failure','Fail validation/storage during replacement','The existing avatar survives and no broken file reference persists'],
 ['Avatar file-size boundary','Upload images near the agreed size/resolution caps','Enforce documented limits with a useful message'],
 ['Profile unsafe content rendering','Render URL/HTML-looking text in every profile display','No executable content or unsafe navigation is introduced'],
 ['Leaderboard tie policy','Create equal scores with differing submission times','Ranks follow a documented stable tie-break policy'],
 ['Export content and escaping','Parse PDF/XLSX exports containing Unicode and formula-looking identifiers','Counts, ranks, timezones and text match the source without formula execution'],
 ['History pagination consistency','Navigate pages while new submissions arrive','No misleading totals, duplicates or omissions under documented ordering'],
 ['Unknown status in every view','Inject missing/unknown statuses into history/profile/results','Every view shows a truthful unavailable state'],
 ['Student profile privacy','Try another student’s profile/history identifiers','Private fields and submissions follow documented visibility rules'],
 ]],
 ['Accessibility and devices','All roles',[
 ['Keyboard-only complete workflows','Navigate login, authoring, assignment and editor without a mouse','All actions are reachable with visible focus and no trap'],
 ['Screen reader forms and errors','Read labels, validation errors, dialogs and execution results','Names/roles/status announcements are meaningful'],
 ['200% and 400% zoom','Zoom populated pages and dialogs','Content and actions remain usable with appropriate reflow'],
 ['Contrast and focus visibility','Measure text, controls and focus in all relevant states','Meet the agreed accessibility contrast requirements'],
 ['Chrome and Firefox workflows','Run main workflows in current Chrome and Firefox','No browser-specific functional failures'],
 ['Safari and actual iOS','Run login/editor/dialog flows on Safari and an iPhone','Main workflows remain usable; identify editor limitations explicitly'],
 ['Actual Android and touch','Run core student/faculty flows on a touch device','Controls and scrolling work without hover dependence'],
 ['Populated 320 px pages beyond profile','Use long titles/names and many records on every route','No hidden actions or horizontal page overflow'],
 ]],
 ['Resilience and integrations','All roles / operations',[
 ['API offline and 5xx recovery','Fail reads/writes then restore the API','Show recoverable error states and no false success'],
 ['Out-of-order responses','Delay an old search/filter request past a newer one','Only the current selection is displayed'],
 ['External judge outage','Make the judge temporarily unavailable during test jobs','Bounded retries and truthful terminal/recoverable status'],
 ['RabbitMQ outage and reconnect','Interrupt the broker during temporary submissions','Jobs recover without loss or duplicate grades'],
 ['Cache outage behavior','Interrupt Redis in an isolated test environment','Document fail-open/fail-closed behavior for sessions and rate limits'],
 ['Actual AI provider generation','Use an approved valid provider key and generate/convert a problem','Valid content is validated before save; provider failures are explained'],
 ['AI malformed response','Inject invalid/truncated provider content','No partial problem creation; useful retry/error message'],
 ['Legacy migration on representative data','Run migration on an isolated representative snapshot','Reconcile record counts, ownership, scores and encoding'],
 ]],
 ['Deployment and release','Operations / developer',[
 ['Production secure cookies and TLS','Deploy to the intended HTTPS domain','Cookie security, CSRF and trusted origins match deployment'],
 ['Fresh installation and migrations','Start an isolated empty database from documented setup','All services become healthy and required admin bootstrap works'],
 ['Upgrade with existing data','Apply migrations to an isolated prior-version snapshot','Existing data and relationships remain valid'],
 ['Backup and restore rehearsal','Restore database/media backups in an isolated environment','Reconcile users, files, assignments and submissions'],
 ['Sandbox privilege review','Review the production execution service separately from approved local root setup','Production privileges and isolation meet the agreed threat model'],
 ['Secrets and logging review','Inspect build assets, responses and logs with test credentials','No private keys/passwords/tokens are exposed'],
 ['Service restart persistence','Restart all services without deleting volumes','Existing data persists and services recover'],
 ['Clean build and quality gate','Run the release build, lint and regression suite after fixes','Required checks pass and known exclusions are documented'],
 ]],
];
let p=0;
for(const [area,role,cases] of pendingGroups)for(const [scenario,steps,expected] of cases)scenarios.push({id:`PLAN-${String(++p).padStart(3,'0')}`,area,role,scenario,steps,inputs:'Temporary data / isolated environment; agree unspecified policy or limits first',expected,actual:'Not executed in this audit; this is a release checklist item',status:'Not run',method:'Planned release verification',bug:'',source:'Audit coverage plan',evidence:''});
const statuses=scenarios.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
const wb=Workbook.create();
const summary=wb.worksheets.add('Summary'), bugs=wb.worksheets.add('Bugs'), tests=wb.worksheets.add('Scenarios');
const letters=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
function sheetBase(s,last,rows,title,note){s.showGridLines=false;s.getRange(`A1:${last}${rows}`).format={font:{name:'Arial',size:10,color:'#172033'},verticalAlignment:'top',wrapText:true};s.getRange('A2').values=[[title]];s.getRange('A2').format.font={name:'Arial',size:14,bold:true,color:'#172033'};s.getRange(`A2:${last}2`).format.rowHeight=26;s.getRange(`A3:${last}3`).format.borders={bottom:{style:'thin',color:'#CBD5E1'}};s.getRange('A4').values=[[note]];s.getRange('A4').format.rowHeight=38;}
function makeTable(s,headers,rows,widths,name){const last=letters(headers.length-1),end=6+rows.length; s.getRange(`A6:${last}${end}`).values=[headers,...rows];const t=s.tables.add(`A6:${last}${end}`,true,name);t.style='TableStyleMedium2';t.showFilterButton=true;s.getRange(`A6:${last}6`).format={fill:'#26344B',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',rowHeight:32,wrapText:true};s.getRange(`A7:${last}${end}`).format.rowHeight=92;widths.forEach((w,i)=>s.getRange(`${letters(i)}1:${letters(i)}${end}`).format.columnWidth=w);s.freezePanes.freezeRows(6);s.freezePanes.freezeColumns(2);return end;}
const bugRows=definitions.map((d,i)=>{const linked=grouped.get(d[0])||[];const first=linked[0];if(!first)throw Error('No evidence '+d[0]);return[idMap.get(d[0]),d[1],d[2],first.area,d[3],d[4],first.role,first.method,[first.steps,first.inputs?'Inputs: '+first.inputs:''].filter(Boolean).join('\n'),first.expected,first.actual,d[5],d[6],linked.map(x=>x.id).join(', '),[...new Set(linked.map(x=>x.source))].join('\n'),'Open','','Not run','',''];});
sheetBase(bugs,'T',bugRows.length+6,'Confirmed findings','Original observations are preserved. Amber columns P:S track fixes; close only after a passing retest. Filter Priority first.');
const be=makeTable(bugs,['Bug ID','Priority','Finding type','Area','Finding','Impact','Role','Verification method','Reproduction / inputs','Expected','Observed','Suggested fix','Acceptance check','Linked scenarios','Code / evidence source','Fix status','Owner','Retest result','Retest notes / date','Completion'],bugRows,[11,9,17,23,37,44,18,28,58,48,68,54,54,29,54,20,20,19,45,21],'BugsTable');
bugs.getRange(`P7:S${be}`).format.fill='#FFF4CC';
bugs.getRange(`P7:P${be}`).dataValidation={rule:{type:'list',values:['Open','In progress','Ready for retest','Closed','Deferred']}};
bugs.getRange(`R7:R${be}`).dataValidation={rule:{type:'list',values:['Not run','Passed','Failed','Blocked']}};
bugs.getRange(`T7:T${be}`).formulas=bugRows.map((_,i)=>{const r=i+7;return[`=IF(AND(P${r}="Closed",R${r}="Passed"),"Verified fixed",IF(P${r}="Closed","Needs retest",P${r}))`];});
bugs.getRange(`B7:B${be}`).conditionalFormats.addCustom('=$B7="P1"',{fill:'#FEE2E2',font:{bold:true,color:'#991B1B'}});
bugs.getRange(`T7:T${be}`).conditionalFormats.addCustom('=$T7="Needs retest"',{fill:'#FEE2E2',font:{bold:true,color:'#991B1B'}});
// Estimate heights from the widest text blocks; preserve full observations without truncating cells.
for(let i=0;i<bugRows.length;i++){const row=bugRows[i];const widths=[11,9,17,23,37,44,18,28,58,48,68,54,54,29,54,20,20,19,45,21];const lines=Math.max(...row.map((v,c)=>String(v).split('\n').reduce((a,x)=>a+Math.max(1,Math.ceil(x.length/(widths[c]*0.85))),0)));bugs.getRange(`A${i+7}:T${i+7}`).format.rowHeight=Math.min(409,Math.max(92,lines*13+14));}
const testRows=scenarios.map(r=>[r.id,r.status,r.area,r.scenario,r.role,r.method,r.steps||'See evidence script for fixture/setup',r.inputs||'',r.expected,r.actual,r.bug,r.source,r.evidence,'Not run','','']);
sheetBase(tests,'P',testRows.length+6,'Scenario register','Result is the original audit result. Amber columns N:P are editable follow-up retests. Not run means planned coverage, not a pass.');
const te=makeTable(tests,['Scenario ID','Audit result','Area','Scenario','Role','Method / scope','Steps','Inputs / preconditions','Expected','Observed','Bug ID','Code / source','Evidence','Retest result','Retest owner','Retest notes / date'],testRows,[22,14,25,52,23,36,64,52,64,76,11,58,56,19,22,50],'ScenariosTable');
tests.getRange(`N7:P${te}`).format.fill='#FFF4CC';tests.getRange(`N7:N${te}`).dataValidation={rule:{type:'list',values:['Not run','Passed','Failed','Blocked']}};
tests.getRange(`B7:B${te}`).conditionalFormats.addCustom('=$B7="Failed"',{fill:'#FEE2E2',font:{color:'#991B1B',bold:true}});
tests.getRange(`B7:B${te}`).conditionalFormats.addCustom('=$B7="Not run"',{fill:'#FFF4CC',font:{color:'#854D0E'}});
for(let i=0;i<testRows.length;i++){const row=testRows[i];const widths=[22,14,25,52,23,36,64,52,64,76,11,58,56,19,22,50];const lines=Math.max(...row.map((v,c)=>String(v).split('\n').reduce((a,x)=>a+Math.max(1,Math.ceil(x.length/(widths[c]*0.85))),0)));tests.getRange(`A${i+7}:P${i+7}`).format.rowHeight=Math.min(409,Math.max(66,lines*13+14));}
sheetBase(summary,'J',36,'Codify — application audit','Audit date: 14 October 2026 • Current application: http://localhost:5185 • API: 3185 / 8185');
summary.getRange('A1:J36').format.columnWidth=14;summary.getRange('A1:A36').format.columnWidth=31;summary.getRange('B1:B36').format.columnWidth=14;summary.getRange('D1:D36').format.columnWidth=30;summary.getRange('E1:E36').format.columnWidth=15;summary.getRange('G1:J36').format.columnWidth=16;
summary.getRange('A2').format.font={name:'Arial',size:14,bold:true};summary.getRange('A4').format.wrapText=false;summary.getRange('A4').format.rowHeight=23;
summary.getRange('A6:B13').values=[['Audit result','Scenarios'],['Passed',null],['Failed',null],['Not run',null],['Executed',null],['Total planned + executed',null],['Executed pass rate',null],['Failed without linked bug',null]];
summary.getRange('B7:B13').formulas=[['=COUNTIF(Scenarios!$B$7:$B$'+te+',A7)'],['=COUNTIF(Scenarios!$B$7:$B$'+te+',A8)'],['=COUNTIF(Scenarios!$B$7:$B$'+te+',A9)'],['=SUM(B7:B8)'],['=SUM(B7:B9)'],['=IF(B10=0,0,B7/B10)'],['=COUNTIFS(Scenarios!$B$7:$B$'+te+',"Failed",Scenarios!$K$7:$K$'+te+',"")']];summary.getRange('B12').setNumberFormat('0.0%');
summary.getRange('D6:E12').values=[['Finding priority','Count'],['P1',null],['P2',null],['P3',null],['Total findings',null],['Verified fixed',null],['Still unresolved',null]];
summary.getRange('E7:E12').formulas=[['=COUNTIF(Bugs!$B$7:$B$'+be+',D7)'],['=COUNTIF(Bugs!$B$7:$B$'+be+',D8)'],['=COUNTIF(Bugs!$B$7:$B$'+be+',D9)'],['=SUM(E7:E9)'],['=COUNTIF(Bugs!$T$7:$T$'+be+',"Verified fixed")'],['=E10-E11']];
summary.getRange('A16:E22').values=[['Verification scope','Count',null,null,'Interpretation'],['Backend regression',103,null,null,'Isolated database; some integrations mocked'],['Extra API boundaries',api.length,null,null,'Isolated test database; judge status cases controlled'],['Live browser / workflow',browser.length,null,null,'Real local services; one missing-status response injected'],['Route layouts',l,null,null,'Controlled API fixtures; not end-to-end coverage'],['Static quality gate',1,null,null,'Lint findings grouped; not all runtime bugs'],['New-port login smoke',1,null,null,'Real browser login on 5185 succeeded']];
summary.getRange('G6').values=[['Fix order']];summary.getRange('G7').values=[['1. Security, data loss and grading (P1)']];summary.getRange('G9').values=[['2. Core workflow and validation (P2)']];summary.getRange('G11').values=[['3. Copy, MIME and quality debt (P3)']];
summary.getRange('G15').values=[['How to use']];summary.getRange('G16').values=[['Filter Bugs by Priority; assign an owner and update amber cells.']];summary.getRange('G19').values=[['Run the acceptance check after each fix. Mark Closed only with Retest Passed.']];summary.getRange('G22').values=[['Use Scenarios for remaining release coverage and follow-up retest notes.']];
// Wide prose cells are unmerged; neighboring cells remain empty.
for(const address of ['G7:J8','G9:J10','G11:J12','G16:J18','G19:J21','G22:J24']){const [start]=address.split(':');summary.getRange(start).format.columnWidth=48;summary.getRange(start).format.wrapText=true;summary.getRange(start).format.rowHeight=46;}
summary.getRange('A25').values=[['Scope and limits']];summary.getRange('A26').values=[['Findings are confirmed observations, except the explicitly labelled Solution feature gap and static code-quality backlog.']];summary.getRange('A28').values=[['Not run items are a release checklist. No finite audit covers all possible inputs; cross-device, load, production and recovery tests remain.']];summary.getRange('A30').values=[['Historical evidence contains ports 5173/3100 because it predates migration. Retests use 5185 and API 3185/8185.']];summary.getRange('A32').values=[['Download checks confirmed XLSX/PDF files were produced; export contents still need verification. Findings have not been fixed in this audit.']];
for(const r of [26,28,30,32]){summary.getRange(`A${r}`).format.columnWidth=80;summary.getRange(`A${r}`).format.rowHeight=32;summary.getRange(`A${r}`).format.wrapText=true;}
// Restore summary numeric columns after prose width settings; use blank adjoining cells for overflow instead.
summary.getRange('A1:A36').format.columnWidth=34;for(const r of [26,28,30,32]){summary.getRange(`A${r}`).format.wrapText=false;summary.getRange(`A${r}`).format.rowHeight=23;}
summary.getRange('E16:E22').clear({applyTo:'contents'});summary.getRange('A16:E22').format.rowHeight=25;
for(const s of [summary,bugs,tests]){s.getRange('A2').format.wrapText=false;s.getRange('A4').format.wrapText=false;s.getRange('A4').format.rowHeight=24;}
for(const address of ['A6:B6','D6:E6','A16:B16'])summary.getRange(address).format={fill:'#26344B',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:27};
for(const address of ['G6','G15','A25'])summary.getRange(address).format.font={name:'Arial',size:10,bold:true,color:'#26344B'};
summary.getRange('B7:B13').format.horizontalAlignment='right';summary.getRange('E7:E12').format.horizontalAlignment='right';summary.getRange('B17:B22').format.horizontalAlignment='right';
summary.getRange('B13').conditionalFormats.add('cellIs',{operator:'greaterThan',formula:0,format:{fill:'#FEE2E2',font:{color:'#991B1B',bold:true}}});
await wb.recalculate();
console.log(JSON.stringify({findings:definitions.length,scenarios:scenarios.length,statuses,pending:p,priority:definitions.reduce((a,d)=>(a[d[1]]=(a[d[1]]||0)+1,a),{})}));
console.log((await wb.inspect({kind:'region',sheetId:'Summary',range:'A6:E13',maxChars:2500,tableMaxRows:9,tableMaxCols:5})).ndjson);
await fs.mkdir(out,{recursive:true});
for(const [sheetName,range,name] of [['Summary','A1:J34','summary-preview.png'],['Bugs','A5:F9','bugs-preview.png'],['Scenarios','A5:F10','scenarios-preview.png']]){const png=await wb.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(path.join(evidence,name),new Uint8Array(await png.arrayBuffer()));}
const output=await SpreadsheetFile.exportXlsx(wb);await output.save(path.join(out,'Codify_Test_Audit_2026-10-14.xlsx'));
await fs.writeFile(path.join(evidence,'workbook-summary.json'),JSON.stringify({findings:definitions.length,scenarios:scenarios.length,statuses,pending:p},null,2));
console.log('EXPORTED '+path.join(out,'Codify_Test_Audit_2026-10-14.xlsx'));
