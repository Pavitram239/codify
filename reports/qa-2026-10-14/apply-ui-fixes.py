from pathlib import Path
import re

root=Path(__file__).resolve().parents[2]
p=root/'client/src/componets/Profile/ProfileRight.jsx'
s=p.read_text()
pattern=r'<label([^>]*)>(.*?)</label>(.*?)<(input|textarea|select)\b([^>]*)>'
def associate(m):
    attrs=m[5]
    name=re.search(r'name="([^"]+)"',attrs)
    field=name[1] if name else 'email'
    return f'<label htmlFor="profile-{field}"{m[1]}>{m[2]}</label>{m[3]}<{m[4]} id="profile-{field}"{attrs}>'
s,count=re.subn(pattern,associate,s,flags=re.S)
assert count==11, count
s=s.replace('value={user.email}','value={user.email || ""}').replace('Enter your GitHub profile name','https://github.com/your-username')
p.write_text(s)
for component in ['Admin/Admin.jsx','Faculty/Faculty.jsx']:
    p=root/'client/src/componets'/component
    s=p.read_text().replace('import toast from "react-hot-toast";','import toast from "react-hot-toast";\nimport TemporaryPasswords from "../TemporaryPasswords";')
    s=s.replace('  const PAGE_SIZE = 10;','  const [credentials, setCredentials] = useState([]);\n  const PAGE_SIZE = 10;')
    for method in ['handleAcceptUser','handleAcceptAll']:
        start=s.index('  const '+method)
        end=s.find('\n  const ',start+10)
        if end<0:end=s.index('  return (',start)
        section=s[start:end]
        section=re.sub(r'(if \(response(?:\?\.)?\.?data(?:\?\.)?\.?success\) \{)',r'\1\n        setCredentials(response.data.temporaryPasswords || []);',section)
        s=s[:start]+section+s[end:]
    pos=s.index('\n',s.index('<div',s.index('  return (')))+1
    s=s[:pos]+'      <TemporaryPasswords credentials={credentials} onDismiss={() => setCredentials([])} />\n'+s[pos:]
    p.write_text(s)
