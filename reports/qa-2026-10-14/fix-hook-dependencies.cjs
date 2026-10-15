const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'),client=path.join(root,'client');
const requireClient=createRequire(path.join(client,'package.json'));
const parser=requireClient('@babel/parser'),traverse=requireClient('@babel/traverse').default;
for(const [file,name,deps,oldDeps,newDeps] of [
 ['Admin/StudentList.jsx','fetchStudents','facultyId','[facultyId, currentPage]','[fetchStudents, currentPage]'],
 ['Faculty/Faculty.jsx','fetchUsers','user','[currentPage]','[fetchUsers, currentPage]'],
 ['Faculty/FacultyRegister.jsx','fetchStudents','user','[currentPage]','[fetchStudents, currentPage]'],
 ['Contest/ContestDashboard.jsx','fetchDashboard','id, filters','[id, filters]','[fetchDashboard]'],
 ['Problem/Submission.jsx','fetchSubmissions','problemId','[userId, problemId]','[userId, fetchSubmissions]'],
 ['Problem/Dashboard.jsx','applyFilters','submissions, filters',null,null],
]){
 const p=path.join(client,'src/componets',file);let source=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');let target;
 traverse(parser.parse(source,{sourceType:'module',plugins:['jsx']}),{VariableDeclarator(p){if(p.node.id.name===name)target=p.node.init;}});
 if(!target)throw Error(name);
 if(!(target.type==='CallExpression'&&target.callee.name==='useCallback'))source=source.slice(0,target.start)+`useCallback(${source.slice(target.start,target.end)}, [${deps}])`+source.slice(target.end);
 source=source.replace(/import \{ ([^}]+) \} from "react";/,(_,list)=>`import { ${list.includes('useCallback')?list:list+', useCallback'} } from "react";`);
 if(oldDeps)source=source.replace(oldDeps,newDeps);
 else{
  const block='  useEffect(() => {\n    applyFilters();\n  }, [filters]);';
  if(!source.includes(block))throw Error('Filter effect missing');
  source=source.replace(block,'');
  const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});let end;
  traverse(ast,{VariableDeclaration(p){if(p.node.declarations.some(d=>d.id.name===name))end=p.node.end;}});
  source=source.slice(0,end)+'\n\n  useEffect(() => { applyFilters(); }, [applyFilters]);'+source.slice(end);
 }
 parser.parse(source,{sourceType:'module',plugins:['jsx']});fs.writeFileSync(p,source);
}
const studentInfo=path.join(client,'src/componets/Admin/StudentInfo.jsx');
let source=fs.readFileSync(studentInfo,'utf8').replace(/StudentInfo\.propTypes = \{[\s\S]*?\};/g,'');
source=source.replace('export default StudentInfo;', 'BranchWiseCount.propTypes = { branches: PropTypes.array.isRequired };\nSemesterWiseCount.propTypes = { semesters: PropTypes.object.isRequired };\n\nexport default StudentInfo;');
fs.writeFileSync(studentInfo,source);
const show=path.join(client,'src/componets/Problem/ProblemShow.jsx');source=fs.readFileSync(show,'utf8');
const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});let templates;
traverse(ast,{VariableDeclaration(p){if(p.node.declarations.some(d=>d.id.name==='codeTemplates'))templates=p.node;}});
const templateSource=source.slice(templates.start,templates.end);source=source.slice(0,templates.start)+source.slice(templates.end);
source=source.replace('const ProblemShow =',templateSource+'\n\nconst ProblemShow =');
source=source.replace('  const { state } = location;','').replace('  const location = useLocation();','').replace('import { useLocation } from "react-router-dom";','');
fs.writeFileSync(show,source);
const contests=path.join(client,'src/componets/Contest/MakeContest.jsx');source=fs.readFileSync(contests,'utf8');
source=source.replace(/  const fetchUserRole = \(\) => \{[\s\S]*?\n  \};/,'');
source=source.replace('    fetchUserRole(); // Fetch the user role when component mounts','');
source=source.replace('  const sortedContests =','  useEffect(() => { setUserRole(user.role); }, [user.role]);\n\n  const sortedContests =');
fs.writeFileSync(contests,source);
