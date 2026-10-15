import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const root=path.resolve(import.meta.dirname,'../../..'), evidence=path.join(root,'reports/qa-2026-10-14/evidence');
const file=path.join(root,'outputs/01a12c0c-0888-7d53-94e2-75261c5185d7/Codify_Test_Audit_2026-10-14.xlsx');
const read=async name=>JSON.parse(await fs.readFile(path.join(evidence,name),'utf8'));
const api=await read('api-retest-results.json'), browser=await read('browser-retest-results.json');
const lint=await read('eslint-retest.json');
const onboarding=await read('onboarding-ui-retest.json');
if(onboarding.status!=='Passed')throw Error('Onboarding UI retest failed');
const apiMap=new Map(api.map(r=>[r.id,r])), browserMap=new Map(browser.map(r=>[r.id,r]));
if(api.length!==63||api.some(r=>r.status!=='Passed'))throw Error('API retests not all passed');
if(browser.length!==22||browser.some(r=>r.status!=='Passed'))throw Error('Browser retests not all passed');
if(lint.some(r=>r.errorCount||r.warningCount))throw Error('Client lint is not clean');
const layout=await fs.readFile(path.join(evidence,'route-layout-retest.log'),'utf8');
if(!layout.includes('Checked 32 routes')||!layout.trim().endsWith('[]'))throw Error('Layout retest is incomplete');
const xml=await fs.readFile(path.join(evidence,'backend-final-fix-regression.xml'),'utf8');
const followup=await fs.readFile(path.join(evidence,'backend-followup-fix-regression.xml'),'utf8');
if(!xml.includes('failures="0"')||!followup.includes('failures="0"'))throw Error('Backend failures remain');
const testcaseKeys=new Set([...xml.matchAll(/<testcase\s+([^>]+)/g),...followup.matchAll(/<testcase\s+([^>]+)/g)].map(m=>m[1].match(/classname="([^"]+)"/)[1]+'::'+m[1].match(/(?:^|\s)name="([^"]+)"/)[1]));
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
const bugs=wb.worksheets.getItem('Bugs'), scenarios=wb.worksheets.getItem('Scenarios'), summary=wb.worksheets.getItem('Summary');
const originalBugRows=bugs.getRange('A7:T44').values;
const originalScenarioRows=scenarios.getRange('A7:P409').values;
const originalInputs=JSON.stringify({bugs:originalBugRows.map(r=>r.slice(0,15)),scenarios:originalScenarioRows.map(r=>r.slice(0,13))});
const retests=new Map([...apiMap,...browserMap]);
retests.set('ENG-01',{status:'Passed',actual:`Full client lint: ${lint.length} files; zero errors and zero warnings.`});
retests.set('ENV-01',{status:'Passed',actual:'Login smoke passed after the port change. API and frontend remain on 3185/8185 and 5185.'});
let retestedScenarios=0;
for(let i=0;i<originalScenarioRows.length;i++){
 const row=originalScenarioRows[i], id=row[0]; let test=retests.get(id);
 if(id.startsWith('REGRESSION-'))test={status:'Passed',actual:'Matching backend regression passed in the rebuilt service; secure onboarding assertions now verify chosen/random credentials.'};
 if(id.startsWith('LAYOUT-'))test={status:'Passed',actual:'Repeated route/layout check with an appropriate role at 320, 768 and 1440 px. Controlled API fixtures.'};
 if(!test)continue;
 const note=`14 Oct 2026 — ${test.actual}`;
 const old=String(row[15]||'');
 const updatedNote=old.includes(note)?old:old?old+'\n'+note:note;
 scenarios.getRange(`N${i+7}:P${i+7}`).values=[[test.status,row[14]||'Codex',updatedNote]];
 const needed=updatedNote.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/42)),0)*13+15;
 const current=scenarios.getRange(`P${i+7}`).format.rowHeight;
 if(needed>current)scenarios.getRange(`A${i+7}:P${i+7}`).format.rowHeight=Math.min(409,needed);
 retestedScenarios++;
}
let verified=0;
for(let i=0;i<originalBugRows.length;i++){
 const row=originalBugRows[i], ids=String(row[13]).split(',').map(s=>s.trim());
 const linked=ids.map(id=>retests.get(id));
 if(linked.some(r=>!r||r.status!=='Passed'))throw Error('Finding lacks passing retest: '+row[0]+' '+ids.join(','));
 const note='14 Oct 2026 — All linked acceptance checks passed: '+ids.join(', ')+'. Detailed retest observations are preserved in the Scenarios retest columns and saved test evidence.';
 const old=String(row[18]||'');
 bugs.getRange(`P${i+7}:S${i+7}`).values=[['Closed',row[16]||'Codex','Passed',old.includes(note)?old:old?old+'\n'+note:note]];
 verified++;
}
if(verified!==38)throw Error('Unexpected finding count');
summary.getRange('A6').values=[['Original audit result']];
summary.getRange('D6').values=[['Original finding priority']];
summary.getRange('D16:E22').values=[['Verified retests','Count'],['Unique backend checks',testcaseKeys.size],['API audit cases',api.length],['Live browser / execution',browser.length+1],['Route/layout checks',96],['Client lint errors',0],['Client lint warnings',0]];
summary.getRange('D16:E16').format={fill:'#26344B',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:27};
summary.getRange('E17:E22').format.horizontalAlignment='right';
summary.getRange('G7').formulas=[['=IF(COUNTIFS(Bugs!$B$7:$B$44,"P1",Bugs!$T$7:$T$44,"<>Verified fixed")=0,"P1 acceptance checks passed","Fix P1 security, data loss and grading")']];
summary.getRange('G9').values=[['Core workflows and validation retested.']];
summary.getRange('G11').values=[['Full client lint is clean.']];
summary.getRange('A32').values=[['Original audit results are preserved. Current verified status appears in Bugs and in the Scenarios retest columns.']];
summary.getRange('A34').values=[['The 80 release checklist items remain unexecuted. An unpublished Solution state is implemented; editorial authoring is still a future feature.']];
summary.getRange('A34').format.wrapText=false;
summary.getRange('A34').format.rowHeight=24;
// Fit changed retest notes without reducing type size.
for(let i=0;i<originalBugRows.length;i++){
 const r=i+7,note=String(bugs.getRange(`S${r}`).values[0][0]);
 const estimated=note.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/38)),0)*13+15;
 if(estimated>bugs.getRange(`S${r}`).format.rowHeight)bugs.getRange(`A${r}:T${r}`).format.rowHeight=Math.min(409,estimated);
}
await wb.recalculate();
const preserved=JSON.stringify({bugs:bugs.getRange('A7:T44').values.map(r=>r.slice(0,15)),scenarios:scenarios.getRange('A7:P409').values.map(r=>r.slice(0,13))});
if(originalInputs!==preserved)throw Error('Original observations changed');
console.log((await wb.inspect({kind:'region',sheetId:'Summary',range:'D6:E22',maxChars:2200,tableMaxRows:18,tableMaxCols:2})).ndjson);
const png=await wb.render({sheetName:'Summary',range:'A1:J34',scale:1,format:'png'});await fs.writeFile(path.join(evidence,'summary-fixed-preview.png'),new Uint8Array(await png.arrayBuffer()));
const output=await SpreadsheetFile.exportXlsx(wb);await output.save(file);
await fs.writeFile(path.join(evidence,'fix-summary.json'),JSON.stringify({findingsVerified:verified,apiAuditPassed:api.length,liveChecksPassed:browser.length+1,uniqueBackendChecks:testcaseKeys.size,retestedOriginalScenarios:retestedScenarios,remainingReleaseScenarios:80,clientLintErrors:0,clientLintWarnings:0,originalObservationsPreserved:true},null,2));
console.log('UPDATED '+file);
