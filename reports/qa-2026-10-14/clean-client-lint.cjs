const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'),client=path.join(root,'client');
const requireClient=createRequire(path.join(client,'package.json'));
const {ESLint}=requireClient('eslint'),parser=requireClient('@babel/parser'),traverse=requireClient('@babel/traverse').default;

(async()=>{
 const eslint=new ESLint({cwd:client});const reports=await eslint.lintFiles(['.']);
 let changed=0;
 for(const report of reports){
  if(!report.messages.some(m=>['no-unused-vars','react/prop-types'].includes(m.ruleId)))continue;
  let source=fs.readFileSync(report.filePath,'utf8');const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
  const unused=new Set(report.messages.filter(m=>m.ruleId==='no-unused-vars').map(m=>`${m.line}:${m.column}`));
  const isUnused=n=>n?.type==='Identifier'&&unused.has(`${n.loc.start.line}:${n.loc.start.column+1}`);
  const edits=[];const consumed=new Set();
  const replace=(node,text)=>{const key=`${node.start}:${node.end}`;if(!consumed.has(key)){consumed.add(key);edits.push({start:node.start,end:node.end,text});}};
  function pruneList(owner,nodes,removed){const remaining=nodes.filter(n=>!removed.has(n));if(!remaining.length){replace(owner,'');return;}for(const node of removed){const index=nodes.indexOf(node);let start=node.start,end=node.end;if(index<nodes.length-1)end=nodes[index+1].start;else if(index>0)start=nodes[index-1].end;edits.push({start,end,text:''});}}
  traverse(ast,{
   ImportDeclaration(p){const removed=new Set(p.node.specifiers.filter(n=>isUnused(n.local)));if(!removed.size)return;
    const remaining=p.node.specifiers.filter(n=>!removed.has(n));
    if(!remaining.length){replace(p.node,'');return;}
    const defaults=remaining.filter(n=>n.type==='ImportDefaultSpecifier').map(n=>source.slice(n.start,n.end));
    const namespace=remaining.filter(n=>n.type==='ImportNamespaceSpecifier').map(n=>source.slice(n.start,n.end));
    const named=remaining.filter(n=>n.type==='ImportSpecifier').map(n=>source.slice(n.start,n.end));
    replace(p.node,`import ${[...defaults,...namespace,...(named.length?['{ '+named.join(', ')+' }']:[])].join(', ')} from ${source.slice(p.node.source.start,p.node.source.end)};`);
   },
   CatchClause(p){if(isUnused(p.node.param))edits.push({start:p.node.start,end:p.node.body.start,text:'catch '});},
   VariableDeclarator(p){const n=p.node;
    if(isUnused(n.id)){pruneList(p.parent,p.parent.declarations,new Set([n]));return;}
    if(n.id.type==='ArrayPattern'){
     const bindings=n.id.elements.filter(Boolean);
     if(bindings.length&&bindings.every(isUnused)){pruneList(p.parent,p.parent.declarations,new Set([n]));return;}
     for(const el of bindings)if(isUnused(el))replace(el,'');
    }
   },
   ObjectPattern(p){const removed=new Set(p.node.properties.filter(n=>isUnused(n.value)));if(!removed.size)return;if(removed.size===p.node.properties.length&&p.parent.type==='VariableDeclarator'){pruneList(p.parentPath.parent,p.parentPath.parent.declarations,new Set([p.parent]));}else if(removed.size===p.node.properties.length){replace(p.node,'{}');}else pruneList(p.node,p.node.properties,removed);},
   Function(p){const removed=new Set(p.node.params.filter(isUnused));if(!removed.size)return;
    const remaining=p.node.params.filter(n=>!removed.has(n));
    for(const node of removed){const index=p.node.params.indexOf(node);let start=node.start,end=node.end;if(index<p.node.params.length-1)end=p.node.params[index+1].start;else if(index>0)start=p.node.params[index-1].end;edits.push({start,end,text:remaining.length?'':''});}
   }
  });
  // Retain outer edits when a removed declaration contains other unused bindings.
  const ordered=edits.sort((a,b)=>a.start-b.start||b.end-a.end),selected=[];
  for(const e of ordered){const previous=selected.at(-1);if(previous&&e.start>=previous.start&&e.end<=previous.end)continue;if(previous&&e.start<previous.end){previous.end=Math.max(previous.end,e.end);continue;}selected.push(e);}
  for(const e of selected.reverse())source=source.slice(0,e.start)+e.text+source.slice(e.end);
  const roots=[...new Set(report.messages.filter(m=>m.ruleId==='react/prop-types').map(m=>m.message.match(/^'([^']+)'/)[1].split('.')[0]))];
  if(roots.length){
   const name=source.match(/export default ([A-Za-z_$][\w$]*);/)?.[1];if(!name)throw Error('Cannot identify component '+report.filePath);
   if(!source.includes('from "prop-types"')&&!source.includes("from 'prop-types'"))source='import PropTypes from "prop-types";\n'+source;
   const type=key=>/^(on[A-Z]|handle[A-Z]|set[A-Z]|toggle|fetch|dispatch|cancel|close)/.test(key)?'func':/^(is[A-Z]|show[A-Z]|loading|disabled|authentication)/.test(key)?'bool':/^(students|submissions|testResults|testCases|cases|results|skills|options|credentials)$/.test(key)?'array':/^(user|formData|problem|submission|filters|selectedStudents)$/.test(key)?'object':/^(score|index|currentPage|totalPages|totalMarks|limit|semester)$/.test(key)?'number':/^(children|message|modalMessage|content)$/.test(key)?'node':/^(language|code|title|theme|imageUrl|error|description|activeTab)$/.test(key)?'string':'any';
   const declaration=`\n${name}.propTypes = {\n${roots.map(key=>`  ${key}: PropTypes.${type(key)},`).join('\n')}\n};\n`;
   source=source.replace(`export default ${name};`,declaration+`\nexport default ${name};`);
  }
  try { parser.parse(source,{sourceType:'module',plugins:['jsx']}); } catch(error) { throw new Error(report.filePath+'\n'+error.message+'\n'+source.split('\n').slice(Math.max(0,error.loc.line-3),error.loc.line+2).join('\n')); }
  if(source!==fs.readFileSync(report.filePath,'utf8')){fs.writeFileSync(report.filePath,source);changed++;}
 }
 console.log('Cleaned unused bindings and declared component props in '+changed+' files.');
})().catch(e=>{console.error(e);process.exitCode=1;});
